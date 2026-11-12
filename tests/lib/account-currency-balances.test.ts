import { expect, it } from 'vitest';
import { accountCurrencyBalances } from '@/lib/account-currency-balances';
import type { Account } from '@/types';

it('keeps balances in their native currencies and excludes archived accounts', () => {
  const accounts = [
    { currency: 'USD', balance: 5, is_active: true },
    { currency: 'COP', balance: 100000, is_active: true },
    { currency: 'COP', balance: -20000, is_active: true },
    { currency: 'COP', balance: 999, is_active: false },
    { currency: 'USD', balance: 999, is_active: true, deleted_at: '2026-01-01' },
  ] as Account[];
  expect(accountCurrencyBalances(accounts)).toEqual([
    { id: 'COP', currency: 'COP', balance: 80000 },
    { id: 'USD', currency: 'USD', balance: 5 },
  ]);
});

it('preserves zero balances without inventing additional currencies', () => {
  expect(accountCurrencyBalances([])).toEqual([]);
  expect(
    accountCurrencyBalances([{ currency: 'EUR', balance: 0, is_active: true }] as Account[]),
  ).toEqual([{ id: 'EUR', currency: 'EUR', balance: 0 }]);
});
