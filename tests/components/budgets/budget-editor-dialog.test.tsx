import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BudgetEditorDialog } from '@/components/budgets/budget-editor-dialog';
import type { Category } from '@/types/category';

const save = vi.hoisted(() => vi.fn());
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
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
  afterEach(() => vi.unstubAllGlobals());

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
});
