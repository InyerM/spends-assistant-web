'use client';

import { useState } from 'react';
import { BalanceOverview } from '@/components/dashboard/balance-overview';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { SpendingByCategory } from '@/components/dashboard/spending-by-category';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { MonthSelector } from '@/components/dashboard/month-selector';
import { AccountEditDialog } from '@/components/accounts/account-edit-dialog';
import { AccountCreateDialog } from '@/components/accounts/account-create-dialog';
import type { Account } from '@/types';

export default function DashboardPage(): React.ReactElement {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  const handleMonthChange = (newYear: number, newMonth: number): void => {
    setYear(newYear);
    setMonth(newMonth);
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <BalanceOverview
        onEditAccount={(account): void => setEditingAccount(account)}
        onAddAccount={(): void => setCreateAccountOpen(true)}
      />

      <div className='flex items-center justify-between'>
        <h2 className='text-foreground text-base font-semibold sm:text-lg'>Overview</h2>
        <MonthSelector year={year} month={month} onChange={handleMonthChange} />
      </div>

      <SummaryCards year={year} month={month} />

      <div className='grid gap-6 lg:grid-cols-2'>
        <SpendingByCategory year={year} month={month} />
        <RecentTransactions />
      </div>

      <AccountEditDialog
        account={editingAccount}
        open={editingAccount !== null}
        onOpenChange={(open): void => {
          if (!open) setEditingAccount(null);
        }}
      />

      <AccountCreateDialog open={createAccountOpen} onOpenChange={setCreateAccountOpen} />
    </div>
  );
}
