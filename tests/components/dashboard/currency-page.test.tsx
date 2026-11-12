import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import DashboardPage from '@/app/(dashboard)/dashboard/page';
const state = vi.hoisted(() => ({
  queries: [] as Array<{ currency?: string; enabled?: boolean }>,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/lib/api/queries/account.queries', () => ({
  useAccounts: () => ({
    data: [
      { id: 'cop', currency: 'COP', balance: 1, is_active: true },
      { id: 'usd', currency: 'USD', balance: 2, is_active: true },
    ],
    isLoading: false,
  }),
}));
vi.mock('@/lib/api/queries/planning.queries', () => ({
  usePlanning: () => ({
    data: { preferences: { dashboard_custom_charts: [{ id: 'custom', currency: 'COP' }] } },
  }),
}));
vi.mock('@/lib/api/queries/transaction.queries', () => ({
  useTransactions: (filters: { currency?: string }, options?: { enabled?: boolean }) => {
    state.queries.push({ ...filters, ...options });
    return { data: { data: [], count: 0 }, isLoading: false };
  },
}));
vi.mock('@/lib/stores/transaction-form.store', () => ({ useTransactionFormStore: () => vi.fn() }));
vi.mock('@/lib/dashboard-layout', () => ({
  DASHBOARD_ZONES: ['main'],
  dashboardLayout: () =>
    ['summary', 'budgets', 'custom', 'recent'].map((id) => ({ id, zone: 'main' })),
}));
vi.mock('@/components/planning/dashboard-zone', () => ({
  DashboardZone: ({
    items,
    renderWidget,
  }: {
    items: Array<{ id: string }>;
    renderWidget: (id: string) => ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>{renderWidget(item.id)}</div>
      ))}
    </div>
  ),
}));
vi.mock('@/components/dashboard/dashboard-currency-hero', () => ({
  DashboardCurrencyHero: ({
    currency,
    onCurrencyChange,
  }: {
    currency: string;
    onCurrencyChange: (currency: string) => void;
  }) => <button onClick={() => onCurrencyChange('USD')}>select:{currency}</button>,
}));
vi.mock('@/components/dashboard/summary-cards', () => ({
  SummaryCards: ({ currency }: { currency: string }) => <p>summary:{currency}</p>,
}));
vi.mock('@/components/dashboard/recent-transactions', () => ({
  RecentTransactions: ({ currency }: { currency: string }) => <p>recent:{currency}</p>,
}));
vi.mock('@/components/dashboard/budget-overview', () => ({
  BudgetOverview: () => <p>COP budgets</p>,
}));
vi.mock('@/components/planning/custom-charts', () => ({
  CustomCharts: () => <p>configured custom charts</p>,
}));
vi.mock('@/components/planning/dashboard-editor', () => ({ DashboardEditor: () => null }));
vi.mock('@/components/dashboard/pending-review-widget', () => ({
  PendingReviewWidget: () => null,
}));
vi.mock('@/components/dashboard/top-contacts', () => ({ TopContacts: () => null }));
vi.mock('@/components/dashboard/money-alerts', () => ({ MoneyAlerts: () => null }));
vi.mock('@/components/planning/planning-overview', () => ({ PlanningOverview: () => null }));
vi.mock('@/components/planning/onboarding-card', () => ({ OnboardingCard: () => null }));
vi.mock('@/components/dashboard/balance-overview', () => ({ BalanceOverview: () => null }));
vi.mock('@/components/dashboard/spending-by-category', () => ({ SpendingByCategory: () => null }));
vi.mock('@/components/dashboard/spending-nature-cards', () => ({
  SpendingNatureCards: () => null,
}));
vi.mock('@/components/dashboard/balance-trend-chart', () => ({ BalanceTrendChart: () => null }));
vi.mock('@/components/transactions/period-selector', () => ({ PeriodSelector: () => null }));
vi.mock('@/components/dashboard/usage-card', () => ({ UsageCard: () => null }));
vi.mock('@/components/accounts/account-edit-dialog', () => ({ AccountEditDialog: () => null }));
vi.mock('@/components/accounts/account-create-dialog', () => ({ AccountCreateDialog: () => null }));
afterEach(() => {
  cleanup();
  state.queries = [];
});
it('connects hero selection to queries and built-in widgets while preserving custom-chart currency data', () => {
  render(<DashboardPage />);
  expect(screen.getByText('COP budgets')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'select:COP' }));
  expect(screen.getByText('summary:USD')).toBeVisible();
  expect(screen.getByText('recent:USD')).toBeVisible();
  expect(screen.getByText('budgetsCopOnly')).toBeVisible();
  expect(screen.queryByText('COP budgets')).not.toBeInTheDocument();
  expect(state.queries.some((query) => query.currency === 'USD')).toBe(true);
  expect(state.queries.some((query) => query.currency === undefined && query.enabled)).toBe(true);
});
