'use client';
import { CustomChartBuilder } from '@/components/planning/custom-chart-builder';
import { CustomCharts } from '@/components/planning/custom-charts';

import { usePlanning } from '@/lib/api/queries/planning.queries';
import { dashboardWidgets } from '@/lib/planning';
import { PlanningOverview } from '@/components/planning/planning-overview';
import { OnboardingCard } from '@/components/planning/onboarding-card';
import { DashboardControls } from '@/components/planning/dashboard-controls';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
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
  const { data: planning } = usePlanning();
  const widgets = dashboardWidgets(planning?.preferences.dashboard_widgets);
  const openNew = useTransactionFormStore((s) => s.openNew);
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

      <OnboardingCard
        hasExpense={transactions.some((tx) => tx.type === 'expense')}
        onCreateAccount={() => setCreateAccountOpen(true)}
        onCreateExpense={openNew}
      />
      <DashboardControls />
      <CustomChartBuilder />
      <div className='grid items-start gap-4 sm:gap-6 xl:grid-cols-2'>
        {widgets.map((id) => (
          <div
            key={id}
            className={id === 'accounts' || id === 'nature' ? 'min-w-0 xl:col-span-2' : 'min-w-0'}>
            {id === 'accounts' && (
              <BalanceOverview
                onEditAccount={setEditingAccount}
                onAddAccount={() => setCreateAccountOpen(true)}
              />
            )}
            {id === 'trend' && (
              <BalanceTrendChart transactions={transactions} dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {id === 'categories' && (
              <SpendingByCategory transactions={transactions} isLoading={txLoading} />
            )}
            {id === 'nature' && <SpendingNatureCards transactions={transactions} />}
            {id === 'recent' && <RecentTransactions />}
            {id === 'budgets' && budgetMonth && <BudgetOverview month={budgetMonth} />}
            {id === 'goals' && <PlanningOverview />}
            {id === 'custom' && (
              <CustomCharts
                transactions={transactions}
                partial={(txResult?.count ?? 0) > transactions.length}
              />
            )}
          </div>
        ))}
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
