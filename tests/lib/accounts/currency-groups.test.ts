import { expect, it } from 'vitest';
import { groupAccounts } from '@/lib/accounts/currency-groups';
import type { Account } from '@/types';
it('groups currency ledgers under their visible account without adding their money', () => {
  const accounts = [
    { id: 'cop', name: 'Card', currency: 'COP', balance: 200 },
    { id: 'usd', parent_account_id: 'cop', name: 'Card · USD', currency: 'USD', balance: 5 },
  ] as Account[];
  expect(
    groupAccounts(accounts).map((g) => ({
      id: g.account.id,
      balances: g.ledgers.map((a) => [a.currency, a.balance]),
    })),
  ).toEqual([
    {
      id: 'cop',
      balances: [
        ['COP', 200],
        ['USD', 5],
      ],
    },
  ]);
  expect(groupAccounts([accounts[1]])).toHaveLength(1);
});
