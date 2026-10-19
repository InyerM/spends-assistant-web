import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CategorySuggestions } from '@/components/transactions/category-suggestions';
import { useCategoryFollowupStore } from '@/lib/stores/category-followup.store';
vi.mock('@/lib/api/queries/category.queries', () => ({ useCategories: () => ({ data: [] }) }));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/category-followup.queries', () => ({
  useCategorySuggestions: () => ({
    data: [
      {
        contact_id: 'contact',
        contact_name: 'Lunch shop',
        transaction_id: 'source',
        category_id: 'food',
        category_name: 'Food',
        count: 3,
      },
    ],
    isError: false,
  }),
}));
afterEach(cleanup);
it('opens category review on demand, allowing the same source to be reviewed again', () => {
  render(<CategorySuggestions />);
  fireEvent.click(screen.getByRole('button', { name: 'reviewSuggestions' }));
  fireEvent.click(screen.getByRole('button', { name: 'review' }));
  const first = useCategoryFollowupStore.getState();
  expect(first.transactionId).toBe('source');
  expect(first.direct).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'review' }));
  expect(useCategoryFollowupStore.getState().revision).toBe(first.revision + 1);
});
