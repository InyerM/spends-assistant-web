import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CategoriesPage from '@/app/(dashboard)/categories/page';

const query = vi.hoisted(() => ({
  data: [] as unknown[],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/category.queries', () => ({ useAllCategoryTree: () => query }));
vi.mock('@/lib/api/mutations/category.mutations', () => ({
  useUpdateCategory: () => ({ mutate: vi.fn() }),
  useDeleteCategory: () => ({ mutateAsync: vi.fn() }),
  fetchCategoryWithCounts: vi.fn(),
}));
vi.mock('@/components/categories/category-form-dialog', () => ({ CategoryFormDialog: () => null }));
vi.mock('@/components/shared/confirm-delete-dialog', () => ({ ConfirmDeleteDialog: () => null }));
afterEach(() => {
  cleanup();
  query.data = [];
  query.isError = false;
});
describe('categories workspace', () => {
  it('explains the empty library and keeps creation discoverable', () => {
    render(<CategoriesPage />);
    expect(screen.getByText('noCategoriesDescription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'addFirst' })).toBeInTheDocument();
  });
  it('reveals a matching child without requiring a separate expand action', async () => {
    query.data = [
      {
        id: 'parent',
        name: 'Food',
        slug: 'food',
        type: 'expense',
        is_active: true,
        children: [
          { id: 'child', name: 'Coffee', slug: 'coffee', type: 'expense', is_active: true },
        ],
      },
    ];
    render(<CategoriesPage />);
    await userEvent.type(screen.getByRole('textbox'), 'Coffee');
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editCategory Coffee/ })).toBeInTheDocument();
  });
  it('offers recovery when loading fails', () => {
    query.isError = true;
    render(<CategoriesPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('loadError');
    expect(screen.getByRole('button', { name: 'tryAgain' })).toBeInTheDocument();
  });
});
