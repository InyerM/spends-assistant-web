import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryFormDialog } from '@/components/categories/category-form-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Category } from '@/types/category';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

const parentCategories: Category[] = [
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
    name: 'Salary',
    slug: 'salary',
    type: 'income',
    parent_id: null,
    icon: null,
    color: null,
    is_active: true,
    created_at: '2026-01-01',
  },
];

vi.mock('@/lib/api/queries/category.queries', () => ({
  useAllCategories: () => ({ data: parentCategories }),
}));
vi.mock('@/lib/api/mutations/category.mutations', () => ({
  useCreateCategory: () => ({ mutateAsync: vi.fn() }),
  useUpdateCategory: () => ({ mutateAsync: vi.fn() }),
}));

describe('category parent picker', () => {
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

  it('searches parents of the matching transaction type', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <CategoryFormDialog open onOpenChange={vi.fn()} />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('combobox', { name: 'parent' }));
    expect(screen.getByPlaceholderText('searchCategories')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Food' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Salary' })).not.toBeInTheDocument();
  });
});
