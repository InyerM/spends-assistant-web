import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BudgetCard } from '@/components/budgets/budget-card';
import type { BudgetStatus } from '@/lib/api/queries/budget.queries';
import type { Category } from '@/types/category';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const category: Category = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'owner',
  name: 'Food',
  slug: 'food',
  type: 'expense',
  parent_id: null,
  icon: null,
  color: null,
  is_active: true,
  created_at: '2026-01-01',
};
const budget: BudgetStatus = {
  budget_id: '22222222-2222-4222-8222-222222222222',
  category_id: category.id,
  limit_cop: '500.00',
  spent_cop: '425.00',
  pending_count: 1,
  unknown_currency_count: 0,
  excluded_count: 1,
  threshold: '80',
  contributing_transactions: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      date: '2026-10-03',
      description: 'Lunch',
      amount: 200,
      category_id: category.id,
    },
  ],
};

describe('BudgetCard', () => {
  it('shows spent, limit, alert and data coverage together', () => {
    render(
      <BudgetCard
        budget={budget}
        category={category}
        locale='en'
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('alert80')).toBeInTheDocument();
    expect(screen.getByText(/coverageWarning/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85');
  });

  it('opens the exact transactions included in the budget total', async () => {
    const { container } = render(
      <BudgetCard
        budget={budget}
        category={category}
        locale='en'
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
      />,
    );
    const card = within(container);
    await userEvent.click(card.getByRole('button', { name: /viewMovements/ }));
    expect(card.getByText('Lunch')).toBeInTheDocument();
    expect(card.getByRole('link', { name: /Lunch/ })).toHaveAttribute(
      'href',
      '/transactions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
  });
});
