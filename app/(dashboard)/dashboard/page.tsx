'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { startOfMonth, endOfMonth } from 'date-fns';
import { BalanceOverview } from '@/components/dashboard/balance-overview';
import { BudgetOverview } from '@/components/dashboard/budget-overview';
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
  const budgetMonth =
    dateFrom.slice(0, 7) === dateTo.slice(0, 7) ? `${dateFrom.slice(0, 7)}-01` : null;

  const handlePeriodChange = (newFrom: string, newTo: string): void => {
    setDateFrom(newFrom);
    setDateTo(newTo);
  };

  return (
    <div className='mx-auto max-w-[1480px] space-y-6 p-4 sm:space-y-8 sm:p-8 lg:p-10'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-foreground text-2xl font-semibold tracking-tight sm:text-3xl'>
          {t('overview')}
        </h1>
        <PeriodSelector dateFrom={dateFrom} dateTo={dateTo} onChange={handlePeriodChange} />
      </div>

      <SummaryCards transactions={transactions} isLoading={txLoading} />

      <section aria-label={t('accounts')} className='space-y-3'>
        <h2 className='text-muted-foreground text-sm font-medium'>{t('accounts')}</h2>
        <BalanceOverview
          onEditAccount={(account): void => setEditingAccount(account)}
          onAddAccount={(): void => setCreateAccountOpen(true)}
        />
      </section>

      <section aria-label={t('spendingAnalysis')} className='space-y-4 sm:space-y-6'>
        <h2 className='text-muted-foreground text-sm font-medium'>{t('spendingAnalysis')}</h2>
        <div className='grid items-start gap-4 sm:gap-6 xl:grid-cols-3'>
          <BalanceTrendChart
            className='xl:col-span-2'
            transactions={transactions}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
          <SpendingByCategory transactions={transactions} isLoading={txLoading} />
        </div>
        <SpendingNatureCards transactions={transactions} />
      </section>

      <div className='grid items-start gap-4 sm:gap-6 lg:grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))]'>
        <RecentTransactions />
        {budgetMonth && <BudgetOverview month={budgetMonth} />}
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
