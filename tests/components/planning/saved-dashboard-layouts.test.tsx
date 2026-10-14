import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SavedDashboardLayouts } from '@/components/planning/saved-dashboard-layouts';
const state = vi.hoisted(() => ({ mutate: vi.fn(), saved: [] as unknown[] }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/api/queries/planning.queries', () => ({
  usePlanning: () => ({ data: { preferences: { dashboard_saved_layouts: state.saved } } }),
}));
vi.mock('@/lib/api/mutations/planning.mutations', () => ({
  useSavePlanning: () => ({ mutate: state.mutate, isPending: false, error: null }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.saved = [];
});
it('saves a named snapshot without replacing the active home layout', () => {
  render(
    <SavedDashboardLayouts
      items={[{ id: 'summary', zone: 'overview', width: 12, height: 2 }]}
      blocked={false}
      onApply={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'savedLayouts.name' }), {
    target: { value: 'Weekly' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'savedLayouts.save' }));
  expect(state.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: {
        action: 'preferences',
        preferences: {
          dashboard_saved_layouts: [
            { name: 'Weekly', items: [{ id: 'summary', zone: 'overview', width: 12, height: 2 }] },
          ],
        },
      },
    }),
    expect.any(Object),
  );
});
it('applies a saved layout as a draft without writing financial or active layout state', () => {
  const items = [{ id: 'summary', zone: 'overview', width: 12, height: 2 }];
  state.saved = [{ name: 'Weekly', items }];
  const apply = vi.fn();
  render(<SavedDashboardLayouts items={[]} blocked={false} onApply={apply} />);
  fireEvent.click(screen.getByRole('button', { name: 'Weekly' }));
  expect(apply).toHaveBeenCalledWith(items);
  expect(state.mutate).not.toHaveBeenCalled();
});
