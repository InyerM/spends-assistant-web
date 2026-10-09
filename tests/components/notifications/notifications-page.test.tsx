import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationsPage from '@/app/(dashboard)/notifications/page';
const state = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn(), error: false, total: 101 }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => 'Oct 8, 2026, 10:30 AM' }),
}));
vi.mock('@/lib/api/queries/notifications.queries', () => ({
  useNotifications: (filters: unknown) => {
    state.query(filters);
    return {
      data: {
        total_count: state.total,
        unread_count: 101,
        data: [{ id: 'old-notice', kind: 'budget_near', label: 'Food', read_at: null }],
      },
      isFetching: false,
      isError: state.error,
      refetch: vi.fn(),
    };
  },
  useMarkNotificationsRead: () => ({ mutate: state.mutate, isPending: false }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.error = false;
  state.total = 101;
});
describe('full notification history', () => {
  it('reaches older pages and resets to page one when filtering unread', () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    expect(state.query).toHaveBeenLastCalledWith({ page: 2, limit: 20, unread: false });
    fireEvent.click(screen.getByRole('button', { name: 'unread' }));
    expect(state.query).toHaveBeenLastCalledWith({ page: 1, limit: 20, unread: true });
    expect(state.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled();
  });
  it('supports individual and all read explicitly', () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'markOne' }));
    expect(state.mutate).toHaveBeenCalledWith(
      'old-notice',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'markAll' }));
    expect(state.mutate).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
  it('offers recovery and stops further pagination after a load error', () => {
    state.error = true;
    render(<NotificationsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('error');
    expect(screen.getByRole('button', { name: 'retry' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled();
  });
  it.each(['markOne', 'markAll'])(
    'returns to the first unread page after successful %s shrinks history',
    (action) => {
      state.total = 21;
      render(<NotificationsPage />);
      fireEvent.click(screen.getByRole('button', { name: 'unread' }));
      fireEvent.click(screen.getByRole('button', { name: 'next' }));
      expect(state.query).toHaveBeenLastCalledWith({ page: 2, limit: 20, unread: true });
      fireEvent.click(screen.getByRole('button', { name: action }));
      const options = state.mutate.mock.calls.at(-1)?.[1] as { onSuccess: () => void } | undefined;
      expect(options?.onSuccess).toBeTypeOf('function');
      act(() => {
        state.total = action === 'markAll' ? 0 : 20;
        options?.onSuccess();
      });
      expect(state.query).toHaveBeenLastCalledWith({ page: 1, limit: 20, unread: true });
      expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled();
    },
  );
});
