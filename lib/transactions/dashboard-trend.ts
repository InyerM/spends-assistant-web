import type { Account, Transaction } from '@/types';

/** Current balances cannot establish a historical or incomplete ledger reconstruction. */
export function dashboardTrendUnavailable(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
  dateFrom: string,
  dateTo: string,
  partial: boolean,
  today: string,
): boolean {
  if (partial || dateFrom > today || dateTo < today) return true;
  const active = new Map(
    accounts
      .filter((account) => account.is_active && !account.deleted_at)
      .map((account) => [account.id, account]),
  );
  return transactions.some((transaction) => {
    if (transaction.date > today) return true;
    if (!active.has(transaction.account_id)) return true;
    if (transaction.type !== 'transfer') return false;
    const source = active.get(transaction.account_id);
    const destination = active.get(transaction.transfer_to_account_id ?? '');
    return !source || !destination || source.currency !== destination.currency;
  });
}
