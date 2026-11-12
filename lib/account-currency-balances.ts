import type { Account } from '@/types';

export type CurrencyBalance = Pick<Account, 'id' | 'currency' | 'balance'>;

export function accountCurrencyBalances(accounts: readonly Account[]): CurrencyBalance[] {
  const balances = new Map<string, number>();
  for (const account of accounts) {
    if (!account.is_active || account.deleted_at) continue;
    balances.set(account.currency, (balances.get(account.currency) ?? 0) + account.balance);
  }
  return [...balances]
    .sort(([left], [right]) =>
      left === 'COP' ? -1 : right === 'COP' ? 1 : left.localeCompare(right),
    )
    .map(([currency, balance]) => ({ id: currency, currency, balance }));
}
