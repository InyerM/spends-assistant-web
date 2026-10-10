import { expect, it } from 'vitest';
import { compareStatement } from '@/lib/statement-reconciliation';
it('shows both differences, preserves ambiguous matches and handles incoming transfers', () => {
  const rows = [
    { id: 'a', amount: -100, currency: 'COP', occurred_at_text: '2026-09-11', status: 'pending' },
    { id: 'b', amount: null, currency: 'COP', occurred_at_text: null, status: 'pending' },
  ];
  const transactions = [
    {
      id: 't',
      account_id: 'bank',
      transfer_to_account_id: null,
      amount: 100,
      currency: 'COP',
      date: '2026-09-11',
      type: 'expense',
    },
    {
      id: 'u',
      account_id: 'bank',
      transfer_to_account_id: null,
      amount: 100,
      currency: 'COP',
      date: '2026-09-11',
      type: 'expense',
    },
    {
      id: 'v',
      account_id: 'other',
      transfer_to_account_id: 'bank',
      amount: 20,
      currency: 'COP',
      date: '2026-09-12',
      type: 'transfer',
    },
  ];
  const result = compareStatement(rows, transactions, [], 'bank');
  expect(result.statementOnly.map((r) => r.id)).toEqual(['a', 'b']);
  expect(result.appOnly.map((r) => r.id)).toEqual(['t', 'u', 'v']);
  expect(result.candidates.a).toEqual(['t', 'u']);
  const linked = compareStatement(
    rows,
    transactions,
    [{ observation_id: 'a', transaction_id: 't', valid: true }],
    'bank',
  );
  expect(linked.statementOnly.map((r) => r.id)).toEqual(['b']);
  expect(linked.appOnly.map((r) => r.id)).toEqual(['u', 'v']);
  expect(
    compareStatement(
      rows,
      transactions,
      [{ observation_id: 'a', transaction_id: 't', valid: false }],
      'bank',
    ).statementOnly,
  ).toHaveLength(2);
});
