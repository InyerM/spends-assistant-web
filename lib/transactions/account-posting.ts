import type { Transaction } from '@/types';
/** Project a transfer onto the selected ledger without changing its canonical posting. */
export function accountPosting(
  transaction: Transaction,
  accountId: string,
): { amount: number; currency: string } {
  const destination =
    transaction.type === 'transfer' && transaction.transfer_to_account_id === accountId;
  return {
    amount: destination
      ? (transaction.destination_amount ?? transaction.amount)
      : transaction.amount,
    currency: destination
      ? (transaction.source_currency ?? transaction.currency ?? 'COP')
      : (transaction.currency ?? 'COP'),
  };
}
