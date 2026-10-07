import type { Account, Category, Transaction } from '@/types';
import { inferCategoryFromHistory } from '@/lib/document-review';
import { decodeEmailEntities } from './email-text';
import type { LuloNoticePreview } from './lulo-preview';

export interface ForwardedEmailDraft {
  type: 'expense' | 'income';
  amount: string;
  date: string;
  eventTime: string;
  eventTimeConfirmed: boolean;
  description: string;
  notes: string;
}

export function buildForwardedEmailDraft(
  preview: LuloNoticePreview | null,
  receivedAt: string,
): ForwardedEmailDraft {
  const receiptDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(receivedAt));
  const part = (kind: string): string => receiptDate.find(({ type }) => type === kind)?.value ?? '';
  const parsed = preview?.kind === 'card_purchase' && preview.confidence === 'structured';
  return {
    type: 'expense',
    amount: parsed ? (preview.amountDecimal ?? '') : '',
    date:
      parsed && preview.bankEventAt
        ? preview.bankEventAt.slice(0, 10)
        : `${part('year')}-${part('month')}-${part('day')}`,
    eventTime: parsed && preview.bankEventAt ? preview.bankEventAt.slice(11, 16) : '',
    eventTimeConfirmed: false,
    description: parsed ? (preview.merchant ?? '') : '',
    notes: '',
  };
}

export function inferForwardedAccount(
  preview: LuloNoticePreview | null,
  accounts: Pick<
    Account,
    'id' | 'name' | 'institution' | 'type' | 'last_four' | 'currency' | 'is_active' | 'deleted_at'
  >[],
): string {
  if (preview?.kind !== 'card_purchase' || !preview.cardLastFour) return '';
  const matched = accounts.filter(
    (account) =>
      account.is_active &&
      !account.deleted_at &&
      account.currency === 'COP' &&
      account.type === 'credit_card' &&
      account.last_four === preview.cardLastFour &&
      /\blulo\b/iu.test(`${account.institution ?? ''} ${account.name}`),
  );
  return matched.length === 1 ? matched[0].id : '';
}

export function inferForwardedBancolombiaAccount(
  rawText: string,
  accounts: Pick<
    Account,
    | 'id'
    | 'name'
    | 'institution'
    | 'type'
    | 'last_four'
    | 'bank_account_last_four'
    | 'currency'
    | 'is_active'
    | 'deleted_at'
  >[],
): string {
  if (
    !/^From \(unverified\): [^\n]*@(?:[a-z0-9-]+\.)?notificacionesbancolombia\.com\s*$/imu.test(
      rawText,
    )
  )
    return '';
  const evidence = decodeEmailEntities(rawText)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '');
  const cards = [...evidence.matchAll(/\bT\.\s*(Cred(?:ito)?|Deb(?:ito)?)\s*\*\s*(\d{4})\b/giu)];
  if (cards.length !== 1) return '';
  const credit = cards[0][1].toLowerCase().startsWith('cred');
  const suffix = cards[0][2];
  const matched = accounts.filter(
    (account) =>
      account.is_active &&
      !account.deleted_at &&
      account.currency === 'COP' &&
      /bancolombia/iu.test(`${account.institution ?? ''} ${account.name}`) &&
      (credit
        ? account.type === 'credit_card'
        : account.type === 'savings' || account.type === 'checking') &&
      (account.last_four === suffix || account.bank_account_last_four === suffix),
  );
  return matched.length === 1 ? matched[0].id : '';
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
