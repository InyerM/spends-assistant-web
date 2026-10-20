import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
const usage = vi.hoisted(() => ({
  data: { used_ids: [] as string[] },
  isError: false,
  isPending: false,
  refetch: vi.fn(),
}));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useAllCategoryTree: () => query,
  useCategoryUsage: () => usage,
}));
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
  usage.data.used_ids = [];
  usage.isError = false;
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

it('keeps a used specialized category usual, finds unused categories through More and searches both lists', async () => {
  query.data = [
    {
      id: 'vehicle',
      name: 'Vehicle',
      slug: 'vehicle',
      is_default: true,
      type: 'expense',
      is_active: true,
      children: [
        {
          id: 'leasing',
          name: 'Vehicle leasing',
          slug: 'leasing',
          is_default: true,
          type: 'expense',
          is_active: true,
        },
        {
          id: 'special',
          name: 'Collectibles',
          slug: 'art-collectibles',
          is_default: true,
          type: 'expense',
          is_active: true,
        },
      ],
    },
  ];
  usage.data.used_ids = ['leasing'];
  render(<CategoriesPage />);
  fireEvent.click(screen.getByRole('button', { name: 'subcategories Vehicle' }));
  expect(screen.getByText('Vehicle leasing')).toBeVisible();
  expect(screen.queryByText('Collectibles')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'moreCategories' }));
  expect(screen.getByText('Collectibles')).toBeVisible();
  expect(screen.queryByText('Vehicle leasing')).not.toBeInTheDocument();
  await userEvent.type(screen.getByRole('textbox'), 'leasing');
  expect(screen.getByText('Vehicle leasing')).toBeVisible();
});
it('shows the complete library if category usage cannot be loaded', () => {
  usage.isError = true;
  query.data = [
    {
      id: 'rare',
      name: 'Rare category',
      slug: 'rare',
      type: 'expense',
      is_default: true,
      is_active: true,
      children: [],
    },
  ];
  render(<CategoriesPage />);
  expect(screen.getByText('Rare category')).toBeVisible();
  expect(screen.getByText('usageUnavailable')).toBeVisible();
});
