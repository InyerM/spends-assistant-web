'use client';
import { DashboardZone } from '@/components/planning/dashboard-zone';
import { DASHBOARD_ZONES, dashboardLayout, type WidgetPlacement } from '@/lib/dashboard-layout';
import { DashboardEditor } from '@/components/planning/dashboard-editor';
import { PendingReviewWidget } from '@/components/dashboard/pending-review-widget';
import { TopContacts } from '@/components/dashboard/top-contacts';
import { MoneyAlerts } from '@/components/dashboard/money-alerts';
import { CustomCharts } from '@/components/planning/custom-charts';

import { usePlanning } from '@/lib/api/queries/planning.queries';
import { PlanningOverview } from '@/components/planning/planning-overview';
import { OnboardingCard } from '@/components/planning/onboarding-card';

import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { startOfMonth, endOfMonth } from 'date-fns';
import { BalanceOverview } from '@/components/dashboard/balance-overview';
import { DashboardCurrencyHero } from '@/components/dashboard/dashboard-currency-hero';
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
import { useAccounts } from '@/lib/api/queries/account.queries';
import { accountCurrencyBalances } from '@/lib/account-currency-balances';

function toStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DashboardPage(): React.ReactElement {
  const t = useTranslations('dashboard');
  const guideRequested = useSearchParams().get('guide') === '1';
  const { data: planning } = usePlanning();
  const [requestedCurrency, setCurrency] = useState('COP');
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const balances = accountCurrencyBalances(accounts ?? []);
  const currency = balances.some((balance) => balance.currency === requestedCurrency)
    ? requestedCurrency
    : (balances[0]?.currency ?? 'COP');
  const [draftLayout, setDraftLayout] = useState<WidgetPlacement[] | null>(null);
  const layout =
    draftLayout ??
    dashboardLayout(
      planning?.preferences.dashboard_layout,
      planning?.preferences.dashboard_widgets,
    );
  const openNew = useTransactionFormStore((s) => s.openNew);
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(() => toStr(startOfMonth(now)));
  const [dateTo, setDateTo] = useState(() => toStr(endOfMonth(now)));
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  const { data: txResult, isLoading: txLoading } = useTransactions({
    currency,
    date_from: dateFrom,
    date_to: dateTo,
    limit: 500,
  });

  const transactions = txResult?.data ?? [];
  const hasCustomCharts =
    layout.some((item) => item.id === 'custom') &&
    Array.isArray(planning?.preferences.dashboard_custom_charts) &&
    planning.preferences.dashboard_custom_charts.length > 0;
  const { data: periodResult } = useTransactions(
    { date_from: dateFrom, date_to: dateTo, limit: 500 },
    { enabled: hasCustomCharts || layout.some((item) => item.id === 'trend') },
  );
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
        <div className='flex flex-wrap items-center gap-2'>
          <PeriodSelector dateFrom={dateFrom} dateTo={dateTo} onChange={handlePeriodChange} />
          <DashboardEditor draft={draftLayout} onDraft={setDraftLayout} />
        </div>
      </div>

      <DashboardCurrencyHero
        balances={balances}
        currency={currency}
        onCurrencyChange={setCurrency}
        isLoading={accountsLoading}
      />

      {(txResult?.count ?? 0) > transactions.length && (
        <p role='status' className='text-warning text-sm'>
          {t('currencyPeriodPartial')}
        </p>
      )}

      <OnboardingCard
        force={guideRequested}
        hasExpense={transactions.some((tx) => tx.type === 'expense')}
        onCreateAccount={() => setCreateAccountOpen(true)}
        onCreateExpense={openNew}
      />

      <div className={draftLayout ? 'space-y-5 xl:pr-[380px]' : 'space-y-6'}>
        {DASHBOARD_ZONES.map((zone) => (
          <DashboardZone
            key={zone}
            zone={zone}
            items={layout.filter(
              (item) =>
                item.id !== 'custom' ||
                (Array.isArray(planning?.preferences.dashboard_custom_charts) &&
                  planning.preferences.dashboard_custom_charts.length > 0),
            )}
            editing={draftLayout !== null}
            onChange={setDraftLayout}
            renderWidget={(id) => (
              <>
                {id === 'summary' && (
                  <SummaryCards
                    currency={currency}
                    transactions={transactions}
                    isLoading={txLoading}
                  />
                )}
                {id === 'reviewInbox' && <PendingReviewWidget kind='inbox' />}
                {id === 'reviewDocuments' && <PendingReviewWidget kind='documents' />}
                {id === 'usage' && <UsageCard />}
                {id === 'accounts' && (
                  <BalanceOverview
                    onEditAccount={setEditingAccount}
                    onAddAccount={() => setCreateAccountOpen(true)}
                  />
                )}
                {id === 'trend' && (
                  <BalanceTrendChart
                    partial={!periodResult || periodResult.count > periodResult.data.length}
                    currency={currency}
                    transactions={periodResult?.data ?? []}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                  />
                )}
                {id === 'categories' && (
                  <SpendingByCategory
                    currency={currency}
                    transactions={transactions}
                    isLoading={txLoading}
                  />
                )}
                {id === 'nature' && (
                  <SpendingNatureCards currency={currency} transactions={transactions} />
                )}
                {id === 'contacts' && <TopContacts />}
                {id === 'alerts' && <MoneyAlerts />}
                {id === 'recent' && <RecentTransactions currency={currency} />}
                {id === 'budgets' &&
                  budgetMonth &&
                  (currency === 'COP' ? (
                    <BudgetOverview month={budgetMonth} />
                  ) : (
                    <p className='text-muted-foreground text-sm'>{t('budgetsCopOnly')}</p>
                  ))}
                {id === 'goals' && <PlanningOverview />}
                {id === 'custom' && (
                  <CustomCharts
                    transactions={periodResult?.data ?? []}
                    partial={(periodResult?.count ?? 0) > (periodResult?.data.length ?? 0)}
                  />
                )}
              </>
            )}
          />
        ))}
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
