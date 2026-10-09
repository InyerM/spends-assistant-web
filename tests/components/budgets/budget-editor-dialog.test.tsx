import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetEditorDialog } from '@/components/budgets/budget-editor-dialog';
import type * as BudgetUtils from '@/lib/budgets';
import type { BudgetStatus } from '@/lib/api/queries/budget.queries';
import type { Category } from '@/types/category';

vi.mock('@/lib/budgets', async (importOriginal) => ({
  ...(await importOriginal<typeof BudgetUtils>()),
  currentBudgetMonth: () => '2026-10-01',
}));

const save = vi.hoisted(() => vi.fn());
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.mock('@/lib/api/mutations/budget.mutations', () => ({
  useSaveMonthlyBudget: () => ({ mutate: save, isPending: false }),
}));

const categories: Category[] = [
  {
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
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: 'owner',
    name: 'Supermarket',
    slug: 'supermarket',
    type: 'expense',
    parent_id: '11111111-1111-4111-8111-111111111111',
    icon: null,
    color: null,
    is_active: true,
    created_at: '2026-01-01',
  },
];

describe('budget category picker', () => {
  beforeEach(() => {
    save.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('finds a nested category by search before saving a monthly limit', async () => {
    const user = userEvent.setup();
    render(
      <BudgetEditorDialog
        open
        onOpenChange={vi.fn()}
        month='2026-10-01'
        editing={null}
        categories={categories}
        locale='en'
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'category' }));
    await user.type(screen.getByPlaceholderText('searchCategories'), 'super');
    await user.click(screen.getByRole('option', { name: 'Supermarket' }));
    await user.type(screen.getByLabelText('limitCop'), '500000');
    await user.click(screen.getByRole('button', { name: 'save' }));

    expect(save).toHaveBeenCalledWith(
      {
        month: '2026-10-01',
        category_id: '22222222-2222-4222-8222-222222222222',
        limit_cop: 500000,
        repeat_monthly: false,
      },
      expect.any(Object),
    );
  });

  it('allows category editing and submits its original budget ID', async () => {
    const user = userEvent.setup();
    const editing = {
      budget_id: 'budget-1',
      category_id: categories[0].id,
      limit_cop: '500',
      repeat_monthly: false,
      spent_cop: '0',
      pending_count: 0,
      unknown_currency_count: 0,
      excluded_count: 0,
      threshold: 'none',
      contributing_transactions: [],
    } satisfies BudgetStatus;
    render(
      <BudgetEditorDialog
        open
        onOpenChange={vi.fn()}
        month='2026-10-01'
        editing={editing}
        categories={categories}
        locale='en'
      />,
    );
    expect(screen.getByRole('combobox', { name: 'category' })).toBeEnabled();
    await user.click(screen.getByRole('combobox', { name: 'category' }));
    await user.click(screen.getByRole('option', { name: 'Supermarket' }));
    await user.click(screen.getByRole('button', { name: 'save' }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ budget_id: 'budget-1', category_id: categories[1].id }),
      expect.any(Object),
    );
  });
  it('creates a previous-month comparison with recurrence off', async () => {
    const user = userEvent.setup();
    render(
      <BudgetEditorDialog
        open
        onOpenChange={vi.fn()}
        month='2026-10-01'
        editing={null}
        categories={categories}
        locale='en'
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'comparePreviousMonth' }));
    expect(screen.queryByRole('combobox', { name: 'duration' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'category' }));
    await user.click(screen.getByRole('option', { name: 'Supermarket' }));
    await user.type(screen.getByLabelText('limitCop'), '700');
    await user.click(screen.getByRole('button', { name: 'save' }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ month: '2026-09-01', repeat_monthly: false }),
      expect.any(Object),
    );
  });
  it('keeps a future or current month from being saved as a historical comparison', async () => {
    const user = userEvent.setup();
    render(
      <BudgetEditorDialog
        open
        onOpenChange={vi.fn()}
        month='2026-10-01'
        editing={null}
        categories={categories}
        locale='en'
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'comparePreviousMonth' }));
    await user.click(screen.getByRole('button', { name: 'September 2026' }));
    await user.click(screen.getByRole('button', { name: 'Oct' }));
    expect(screen.getByRole('alert')).toHaveTextContent('pastMonthRequired');
    expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
});
