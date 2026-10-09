import type { Account, Category, Transaction } from '@/types';
import type { AutomationRule } from '@/types/automation-rule';
import { inferCategoryFromHistory } from '@/lib/document-review';
import { decodeEmailEntities } from './email-text';
import type { LuloNoticePreview } from './lulo-preview';
import {
  previewBancolombiaNotice,
  isBancolombiaSender,
  type BancolombiaNoticePreview,
} from './bancolombia-preview';
import { matchesAccountSuffix } from '@/lib/accounts/identifiers';

export interface ForwardedEmailDraft {
  type: 'expense' | 'income' | 'transfer';
  amount: string;
  date: string;
  eventTime: string;
  eventTimeConfirmed: boolean;
  description: string;
  notes: string;
}

type MatchableAccount = Pick<
  Account,
  'id' | 'name' | 'institution' | 'type' | 'last_four' | 'currency' | 'is_active' | 'deleted_at'
> &
  Partial<Pick<Account, 'bank_account_last_four' | 'identifiers'>>;

export function buildForwardedEmailDraft(
  preview: LuloNoticePreview | null,
  receivedAt: string,
  bancolombia: BancolombiaNoticePreview | null = null,
): ForwardedEmailDraft {
  const receiptDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(receivedAt));
  const part = (kind: string): string => receiptDate.find(({ type }) => type === kind)?.value ?? '';
  const purchaseEvidence = preview?.merchant && preview.amountDecimal ? preview : null;
  return {
    type: bancolombia?.kind === 'income' ? 'income' : 'expense',
    amount:
      purchaseEvidence?.amountDecimal ??
      (bancolombia?.currency === 'COP' ? (bancolombia.amountDecimal ?? '') : ''),
    date: bancolombia
      ? (bancolombia.date ?? '')
      : preview
        ? (preview.bankEventAt?.slice(0, 10) ?? '')
        : `${part('year')}-${part('month')}-${part('day')}`,
    eventTime: bancolombia?.time ?? (preview?.bankEventAt ? preview.bankEventAt.slice(11, 16) : ''),
    eventTimeConfirmed: false,
    description: purchaseEvidence?.merchant ?? bancolombia?.merchant ?? '',
    notes: '',
  };
}

export function inferForwardedAccount(
  preview: LuloNoticePreview | null,
  accounts: MatchableAccount[],
): string {
  if (preview?.kind !== 'card_purchase' || !preview.cardLastFour) return '';
  const cardLastFour = preview.cardLastFour;
  const matched = accounts.filter(
    (account) =>
      account.is_active &&
      !account.deleted_at &&
      account.currency === 'COP' &&
      account.type === 'credit_card' &&
      matchesAccountSuffix(account, cardLastFour, 'credit') &&
      /\blulo\b/iu.test(`${account.institution ?? ''} ${account.name}`),
  );
  return matched.length === 1 ? matched[0].id : '';
}

export function inferForwardedBancolombiaAccount(
  rawText: string,
  accounts: MatchableAccount[],
): string {
  if (previewBancolombiaNotice('forwarded_email', rawText)?.currency === 'USD') return '';
  if (!isBancolombiaSender(rawText)) return '';
  const evidence = decodeEmailEntities(rawText)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '');
  const source = sourceAccountReference(evidence);
  if (!source) return '';
  const credit = source.kind === 'credit';
  const suffix = source.suffix;
  const matched = accounts.filter(
    (account) =>
      account.is_active &&
      !account.deleted_at &&
      account.currency === 'COP' &&
      /bancolombia/iu.test(`${account.institution ?? ''} ${account.name}`) &&
      (credit
        ? account.type === 'credit_card'
        : account.type === 'savings' || account.type === 'checking') &&
      matchesAccountSuffix(account, suffix, source.kind),
  );
  return matched.length === 1 ? matched[0].id : '';
}

function sourceAccountReference(
  rawText: string,
): { kind: 'credit' | 'debit'; suffix: string } | null {
  const evidence = decodeEmailEntities(rawText)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '');
  const references = [
    ...[...evidence.matchAll(/\bT\.\s*(Cred(?:ito)?|Deb(?:ito)?)\s*\*+\s*(\d{4})\b/giu)].map(
      (match) => ({
        kind: match[1].toLowerCase().startsWith('cred') ? ('credit' as const) : ('debit' as const),
        suffix: match[2],
      }),
    ),
    ...[...evidence.matchAll(/\bOrigen tarjeta de credito\s*[•*]+\s*(\d{4})\b/giu)].map(
      (match) => ({ kind: 'credit' as const, suffix: match[1] }),
    ),
    ...[...evidence.matchAll(/\bdesde (?:tu|la) cuenta\s*\*+\s*(\d{4})\b/giu)].map((match) => ({
      kind: 'debit' as const,
      suffix: match[1],
    })),
    ...[...evidence.matchAll(/\ben tu cuenta\s*\*+\s*(\d{4})\b/giu)].map((match) => ({
      kind: 'debit' as const,
      suffix: match[1],
    })),
    ...[...evidence.matchAll(/\bdesde tu producto\s+(\d{4})\b/giu)].map((match) => ({
      kind: 'debit' as const,
      suffix: match[1],
    })),
  ];
  const unique = [
    ...new Map(references.map((item) => [`${item.kind}:${item.suffix}`, item])).values(),
  ];
  return unique.length === 1 ? unique[0] : null;
}

export function inferForwardedAccountFromRules(
  rawText: string,
  accounts: MatchableAccount[],
  rules: Pick<
    AutomationRule,
    'rule_type' | 'is_active' | 'condition_logic' | 'conditions' | 'actions'
  >[],
): string {
  if (previewBancolombiaNotice('forwarded_email', rawText)?.currency === 'USD') return '';
  const source = sourceAccountReference(rawText);
  if (!source) return '';
  const evidence = decodeEmailEntities(rawText).toLowerCase();
  const sender = evidence.split('\n', 1)[0] ?? '';
  const matches = new Set<string>();
  for (const rule of rules) {
    if (!rule.is_active || rule.rule_type !== 'account_detection' || !rule.actions.set_account)
      continue;
    const keywords = rule.conditions.raw_text_contains ?? [];
    if (!keywords.some((keyword) => keyword.replace(/^[*•]+/u, '') === source.suffix)) continue;
    const conditionMatches =
      rule.condition_logic === 'and'
        ? keywords.every((keyword) => evidence.includes(keyword.toLowerCase()))
        : keywords.some((keyword) => evidence.includes(keyword.toLowerCase()));
    if (!conditionMatches) continue;
    const account = accounts.find((item) => item.id === rule.actions.set_account);
    if (!account || !account.is_active || account.deleted_at || account.currency !== 'COP')
      continue;
    if (source.kind === 'credit' && account.type !== 'credit_card') continue;
    if (source.kind === 'debit' && account.type !== 'savings' && account.type !== 'checking')
      continue;
    const institution = `${account.institution ?? ''} ${account.name}`.toLowerCase();
    if (/bancolombia/u.test(institution) && !/notificacionesbancolombia\.com/u.test(sender))
      continue;
    if (/lulo/u.test(institution) && !/@lulobank\.com/u.test(sender)) continue;
    if (/falabella/u.test(institution) && !/falabella/u.test(sender)) continue;
    matches.add(account.id);
  }
  return matches.size === 1 ? [...matches][0] : '';
}

export function suggestForwardedCategory(
  preview: LuloNoticePreview | null,
  history: Pick<Transaction, 'description' | 'type' | 'category_id'>[],
  categories: Pick<Category, 'id' | 'slug' | 'type' | 'is_active'>[],
): string {
  if (preview?.kind !== 'card_purchase' || !preview.merchant) return '';
  const merchant = preview.merchant
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, ' ')
    .trim();
  if (/^(?:TIENDAS ARA|SUPERMERCADO MERCAMAS|MERCAMAS)(?: \d{1,4})?$/u.test(merchant)) {
    const known = categories.find(
      (category) =>
        category.slug === 'groceries' && category.type === 'expense' && category.is_active,
    );
    if (known) return known.id;
  }
  const suggestion = inferCategoryFromHistory(preview.merchant, history);
  if (suggestion?.type !== 'expense') return '';
  return categories.some(
    (category) =>
      category.id === suggestion.categoryId && category.type === 'expense' && category.is_active,
  )
    ? suggestion.categoryId
    : '';
}

export function inferForwardedPaymentDestination(
  preview: BancolombiaNoticePreview | null,
  accounts: MatchableAccount[],
): string {
  if (preview?.kind !== 'payment' || !preview.destinationLastFour || preview.currency !== 'COP')
    return '';
  const destinationLastFour = preview.destinationLastFour;
  const matches = accounts.filter(
    (account) =>
      account.is_active &&
      !account.deleted_at &&
      account.currency === 'COP' &&
      account.type === 'credit_card' &&
      /bancolombia/iu.test(`${account.institution ?? ''} ${account.name}`) &&
      matchesAccountSuffix(account, destinationLastFour, 'credit'),
  );
  return matches.length === 1 ? matches[0].id : '';
}
