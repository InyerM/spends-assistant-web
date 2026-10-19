import type { Account } from '@/types';
export interface AccountGroup {
  account: Account;
  ledgers: Account[];
}
export function groupAccounts(accounts: Account[]): AccountGroup[] {
  const ids = new Set(accounts.map((a) => a.id));
  return accounts
    .filter((a) => !a.parent_account_id || !ids.has(a.parent_account_id))
    .map((account) => ({
      account,
      ledgers: [account, ...accounts.filter((a) => a.parent_account_id === account.id)],
    }));
}
