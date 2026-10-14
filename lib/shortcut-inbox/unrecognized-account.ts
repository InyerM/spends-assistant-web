import { accountIdentifiers } from '@/lib/accounts/identifiers';
import {
  extractEmailEventEvidence,
  emailEventBody,
} from '@/lib/shortcut-inbox/email-event-evidence';
import type { Account, AccountIdentifier } from '@/types/account';
export interface SourceAccountSuggestion {
  last_four: string;
  kind: AccountIdentifier['kind'];
  currency: 'COP' | 'USD' | null;
}
type SourceAccount = Pick<Account, 'type' | 'last_four' | 'is_active' | 'deleted_at'> &
  Partial<Pick<Account, 'identifiers' | 'bank_account_last_four' | 'currency'>>;
export function unrecognizedSourceAccount(
  rawText: string,
  accounts: SourceAccount[],
): SourceAccountSuggestion | null {
  const evidence = extractEmailEventEvidence(rawText);
  const text = emailEventBody(rawText)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '');
  const ownReferences = [
    ...text.matchAll(
      /\b(?:desde tu cuenta|en tu cuenta|from your account)\s*(?:de (?:ahorros|ahorro)|corriente)?\s*(?:numero|nro\.?|n[º°]\.?|#)?\s*[*•]*\s*(\d{4,22})\b/giu,
    ),
  ].map((match) => match[1].slice(-4));
  const ownSuffixes = new Set(ownReferences);
  if (ownSuffixes.size > 1 || !evidence.type) return null;
  const suffix = evidence.sourceLastFour ?? (ownSuffixes.size === 1 ? ownReferences[0] : null);
  const sourceKind = evidence.sourceKind ?? (ownSuffixes.size === 1 ? 'debit' : null);
  if (!suffix || !sourceKind || (ownSuffixes.size === 1 && ownReferences[0] !== suffix))
    return null;
  if (
    evidence.type === 'income' &&
    ownSuffixes.size === 0 &&
    !/\b(?:en tu cuenta|a tu cuenta|your account)\b/iu.test(text)
  )
    return null;
  const debitCard =
    /\b(?:T\.\s*Deb(?:ito)?|(?:Origen )?tarjeta de debito)\s*[*•]+\s*(\d{4})\b/iu.exec(
      text,
    )?.[1] === suffix;
  const kind = sourceKind === 'credit' ? 'credit_card' : debitCard ? 'debit_card' : 'bank_account';
  const known = accounts.some(
    (account) =>
      account.is_active &&
      !account.deleted_at &&
      (!evidence.currency || !account.currency || account.currency === evidence.currency) &&
      accountIdentifiers(account).some(
        (identifier) =>
          identifier.is_active && identifier.last_four === suffix && identifier.kind === kind,
      ),
  );
  return known ? null : { last_four: suffix, kind, currency: evidence.currency };
}

export function withSourceIdentifier(
  account: SourceAccount,
  source: SourceAccountSuggestion,
): AccountIdentifier[] {
  const existing = accountIdentifiers(account);
  const hasPrimary = existing.some((identifier) => identifier.is_primary && identifier.is_active);
  const matching = (identifier: AccountIdentifier): boolean =>
    identifier.kind === source.kind && identifier.last_four === source.last_four;
  const rows = existing.some(matching)
    ? existing.map((identifier) =>
        matching(identifier)
          ? { ...identifier, is_active: true, is_primary: identifier.is_primary || !hasPrimary }
          : { ...identifier, is_primary: hasPrimary && identifier.is_primary },
      )
    : [
        ...existing.map((identifier) => ({
          ...identifier,
          is_primary: hasPrimary && identifier.is_primary,
        })),
        {
          kind: source.kind,
          last_four: source.last_four,
          is_active: true,
          is_primary: !hasPrimary,
        },
      ];
  return rows;
}
