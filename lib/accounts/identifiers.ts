import type { Account, AccountIdentifier } from '@/types/account';

export function defaultIdentifierKind(type: string): AccountIdentifier['kind'] {
  return type === 'credit_card' ? 'credit_card' : 'bank_account';
}

type AccountReference = Pick<Account, 'type' | 'last_four'> &
  Partial<Pick<Account, 'bank_account_last_four' | 'identifiers'>>;

export function accountIdentifiers(account: AccountReference): AccountIdentifier[] {
  if (Array.isArray(account.identifiers) && account.identifiers.length > 0) {
    return account.identifiers;
  }
  const identifiers: AccountIdentifier[] = [];
  if (account.last_four) {
    identifiers.push({
      kind:
        account.type === 'credit_card'
          ? 'credit_card'
          : account.bank_account_last_four && account.bank_account_last_four !== account.last_four
            ? 'debit_card'
            : 'bank_account',
      last_four: account.last_four,
      is_active: true,
      is_primary: true,
    });
  }
  if (account.bank_account_last_four && account.bank_account_last_four !== account.last_four) {
    identifiers.push({
      kind: 'bank_account',
      last_four: account.bank_account_last_four,
      is_active: true,
      is_primary: !account.last_four,
    });
  }
  return identifiers;
}

export function primarySuffix(account: AccountReference): string | null {
  return accountIdentifiers(account).find((identifier) => identifier.is_primary)?.last_four ?? null;
}

export function matchesAccountSuffix(
  account: AccountReference,
  suffix: string,
  source: 'credit' | 'debit',
): boolean {
  return accountIdentifiers(account).some(
    (identifier) =>
      identifier.last_four === suffix &&
      (source === 'credit'
        ? identifier.kind === 'credit_card'
        : identifier.kind === 'debit_card' || identifier.kind === 'bank_account'),
  );
}
