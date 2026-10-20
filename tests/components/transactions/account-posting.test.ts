import { expect, it } from 'vitest';
import { accountPosting } from '@/lib/transactions/account-posting';
import type { Transaction } from '@/types';
it('shows the received currency and amount on the destination ledger without altering the canonical transaction', () => {
  const tx = {
    type: 'transfer',
    account_id: 'cop',
    transfer_to_account_id: 'usd',
    amount: 21000,
    currency: 'COP',
    source_currency: 'USD',
    destination_amount: 5,
  } as Transaction;
  expect(accountPosting(tx, 'usd')).toEqual({ amount: 5, currency: 'USD' });
  expect(accountPosting(tx, 'cop')).toEqual({ amount: 21000, currency: 'COP' });
  expect(tx.amount).toBe(21000);
});
