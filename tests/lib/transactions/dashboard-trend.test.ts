import { expect, it } from 'vitest';
import { dashboardTrendUnavailable } from '@/lib/transactions/dashboard-trend';
import type { Account, Transaction } from '@/types';
const accounts = [
  { id: 'cop', currency: 'COP', is_active: true },
  { id: 'usd', currency: 'USD', is_active: true },
] as Account[];
it('declines historical, partial and cross-currency transfer balance reconstruction', () => {
  expect(
    dashboardTrendUnavailable([], accounts, '2026-10-01', '2026-10-31', false, '2026-11-12'),
  ).toBe(true);
  expect(
    dashboardTrendUnavailable([], accounts, '2026-11-01', '2026-11-30', true, '2026-11-12'),
  ).toBe(true);
  expect(
    dashboardTrendUnavailable(
      [
        { type: 'transfer', account_id: 'cop', transfer_to_account_id: 'usd', date: '2026-11-10' },
      ] as Transaction[],
      accounts,
      '2026-11-01',
      '2026-11-30',
      false,
      '2026-11-12',
    ),
  ).toBe(true);
  expect(
    dashboardTrendUnavailable([], accounts, '2026-11-01', '2026-11-30', false, '2026-11-12'),
  ).toBe(false);
});
it('declines reconstruction when a movement belongs to a ledger outside current active balances', () => {
  expect(
    dashboardTrendUnavailable(
      [{ type: 'expense', account_id: 'closed', date: '2026-11-10' }] as Transaction[],
      accounts,
      '2026-11-01',
      '2026-11-30',
      false,
      '2026-11-12',
    ),
  ).toBe(true);
});
