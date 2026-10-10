import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PlanningPage from '@/app/(dashboard)/planning/page';
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/planning.queries', () => ({
  usePlanning: () => ({
    data: {
      goals: [
        {
          id: 'g',
          name: 'Trip',
          currency: 'COP',
          target_amount: 1000,
          saved_amount: 250,
          due_date: null,
        },
      ],
      schedules: [],
      common: [],
      preferences: {},
    },
    isPending: false,
  }),
}));
vi.mock('@/lib/api/mutations/planning.mutations', () => ({
  useSavePlanning: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/lib/api/queries/account.queries', () => ({ useAccounts: () => ({ data: [] }) }));
vi.mock('@/lib/api/queries/category.queries', () => ({ useCategories: () => ({ data: [] }) }));
it('shows goal progress and lets the owner open its editing form', () => {
  render(<PlanningPage />);
  expect(screen.getByText('Trip')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'editGoal' }));
  expect(screen.getByDisplayValue('Trip')).toBeVisible();
});
