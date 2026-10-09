import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetOverview } from '@/components/dashboard/budget-overview';
import type { BudgetStatus } from '@/lib/api/queries/budget.queries';

const query = vi.hoisted(() => ({ data: [] as BudgetStatus[], isError: false }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}));
vi.mock('@/lib/api/queries/budget.queries', () => ({ useMonthlyBudgets: () => query }));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useCategories: () => ({ data: [{ id: 'food', name: 'Food', translations: { es: 'Comida' } }] }),
}));

describe('BudgetOverview', () => {
  afterEach(() => {
    cleanup();
    query.data = [];
    query.isError = false;
  });

  it('does not add a dashboard card for an account without budgets', () => {
    const { container } = render(<BudgetOverview month='2026-10-01' />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows localized categories and actual monthly progress with a budgets link', () => {
    query.data = [
      {
        budget_id: 'budget',
        category_id: 'food',
        limit_cop: '100000',
        spent_cop: '85000',
        pending_count: 1,
        unknown_currency_count: 0,
        excluded_count: 0,
        threshold: '80',
        contributing_transactions: [],
      },
    ];
    render(<BudgetOverview month='2026-10-01' />);
    expect(screen.getByText('Comida')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85');
    expect(screen.getByText('budgetCoverage')).toBeVisible();
    expect(screen.getByText('alert80')).toBeVisible();
    expect(screen.getByRole('link', { name: 'viewBudgets' })).toHaveAttribute('href', '/budgets');
  });
});
