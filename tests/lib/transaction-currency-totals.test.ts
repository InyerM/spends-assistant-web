import { expect, it } from 'vitest';
import { transactionCurrencyTotals } from '@/lib/transactions/currency-totals';
it('keeps daily currency totals separate and excludes internal transfers', () => {
  expect(
    transactionCurrencyTotals([
      { amount: 100, type: 'expense', currency: 'COP' },
      { amount: 5, type: 'income', currency: 'USD' },
      { amount: 8, type: 'transfer', currency: 'USD' },
    ]),
  ).toEqual([
    { currency: 'COP', amount: -100 },
    { currency: 'USD', amount: 5 },
  ]);
});
