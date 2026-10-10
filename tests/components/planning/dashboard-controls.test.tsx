import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DashboardEditor } from '@/components/planning/dashboard-editor';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/api/queries/planning.queries', () => ({ usePlanning: () => ({ isPending: true }) }));
vi.mock('@/lib/api/queries/budget.queries', () => ({ useMonthlyBudgets: () => ({ data: [] }) }));
vi.mock('@/lib/api/mutations/planning.mutations', () => ({
  useSavePlanning: () => ({ isPending: false, mutate: vi.fn() }),
}));
it('does not overwrite saved dashboard preferences while their initial request is pending', () => {
  render(<DashboardEditor draft={null} onDraft={vi.fn()} />);
  for (const control of screen.getAllByRole('button')) expect(control).toBeDisabled();
});
