import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { SpendingNatureCards } from '@/components/dashboard/spending-nature-cards';
import { BalanceTrendChart } from '@/components/dashboard/balance-trend-chart';
import type { Transaction } from '@/types';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('@/lib/api/queries/account.queries', () => ({
  useAccounts: () => ({
    data: [
      { id: 'cop', currency: 'COP', balance: 90000, is_active: true },
      { id: 'usd', currency: 'USD', balance: 50, is_active: true },
    ],
    isLoading: false,
  }),
}));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useCategories: () => ({ data: [{ id: 'food', spending_nature: 'must' }], isLoading: false }),
}));
vi.mock('recharts', () => {
  const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Container,
    AreaChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
    BarChart: Container,
    Area: () => null,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
  };
});
afterEach(cleanup);
const today = format(new Date(), 'yyyy-MM-dd');
const transactions = [
  {
    type: 'expense',
    amount: 10,
    currency: 'USD',
    account_id: 'usd',
    category_id: 'food',
    date: today,
  },
  {
    type: 'expense',
    amount: 90000,
    currency: 'COP',
    account_id: 'cop',
    category_id: 'food',
    date: today,
  },
] as Transaction[];
it('formats summary and nature totals exclusively in the selected currency', () => {
  const view = render(<SummaryCards currency='USD' transactions={transactions} />);
  expect(screen.getAllByText('$10').length).toBeGreaterThan(0);
  expect(view.container.textContent).not.toContain('90,010');
  view.unmount();
  render(<SpendingNatureCards currency='USD' transactions={transactions} />);
  expect(screen.getByText('$10')).toBeVisible();
});
it('anchors a current trend to only the selected active account balances and declines historical periods', () => {
  const view = render(
    <BalanceTrendChart
      currency='USD'
      transactions={transactions}
      dateFrom={today}
      dateTo={today}
    />,
  );
  expect(screen.getByRole('img')).toHaveAccessibleName('balanceTrend: $50');
  view.rerender(
    <BalanceTrendChart
      currency='USD'
      transactions={transactions}
      dateFrom='2020-01-01'
      dateTo='2020-01-31'
    />,
  );
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('balanceTrendUnavailable');
});
