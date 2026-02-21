'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { startOfMonth, endOfMonth } from 'date-fns';
import { BalanceOverview } from '@/components/dashboard/balance-overview';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { SpendingByCategory } from '@/components/dashboard/spending-by-category';
import { SpendingNatureCards } from '@/components/dashboard/spending-nature-cards';
import { BalanceTrendChart } from '@/components/dashboard/balance-trend-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { PeriodSelector } from '@/components/transactions/period-selector';
import { UsageCard } from '@/components/dashboard/usage-card';
import { AccountEditDialog } from '@/components/accounts/account-edit-dialog';
import { AccountCreateDialog } from '@/components/accounts/account-create-dialog';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import type { Account } from '@/types';

function toStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DashboardPage(): React.ReactElement {
  const t = useTranslations('dashboard');
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(() => toStr(startOfMonth(now)));
  const [dateTo, setDateTo] = useState(() => toStr(endOfMonth(now)));
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  const { data: txResult, isLoading: txLoading } = useTransactions({
    date_from: dateFrom,
    date_to: dateTo,
    limit: 500,
  });

  const transactions = txResult?.data ?? [];

  const handlePeriodChange = (newFrom: string, newTo: string): void => {
    setDateFrom(newFrom);
    setDateTo(newTo);
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <BalanceOverview
        onEditAccount={(account): void => setEditingAccount(account)}
        onAddAccount={(): void => setCreateAccountOpen(true)}
      />

      <div className='flex items-center justify-between'>
        <h2 className='text-foreground text-base font-semibold sm:text-lg'>{t('overview')}</h2>
        <PeriodSelector dateFrom={dateFrom} dateTo={dateTo} onChange={handlePeriodChange} />
      </div>

      <SummaryCards transactions={transactions} isLoading={txLoading} />

      <div className='grid gap-4 sm:gap-6 lg:grid-cols-2'>
        <SpendingNatureCards transactions={transactions} dateFrom={dateFrom} dateTo={dateTo} />
        <BalanceTrendChart transactions={transactions} dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        <SpendingByCategory transactions={transactions} isLoading={txLoading} />
        <RecentTransactions />
      </div>

      <UsageCard />

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
