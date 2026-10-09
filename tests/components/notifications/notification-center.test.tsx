import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenter } from '@/components/notifications/notification-center';
const state = vi.hoisted(() => ({ mutate: vi.fn(), isError: false }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => 'Oct 8, 2026, 10:30 AM' }),
}));
vi.mock('@/lib/api/queries/notifications.queries', () => ({
  useNotifications: () => ({
    data: {
      unread_count: 1,
      data: [
        {
          id: 'notice',
          source_id: 'email',
          kind: 'email_received',
          label: 'Bank receipt',
          read_at: null,
        },
      ],
    },
    isError: state.isError,
    refetch: vi.fn(),
  }),
  useMarkNotificationsRead: () => ({ mutate: state.mutate, isPending: false }),
}));
describe('notification center', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    state.isError = false;
  });
  it('keeps reading explicit and links to the searchable inbox', () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(state.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /email_received/ })).toHaveAttribute('href', '/inbox');
    fireEvent.click(screen.getByRole('button', { name: 'markOne' }));
    expect(state.mutate).toHaveBeenCalledWith('notice');
  });
  it('supports marking every notice read separately from financial review', () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.click(screen.getByRole('button', { name: 'markAll' }));
    expect(state.mutate).toHaveBeenCalledWith(undefined);
  });
  it('offers recovery after a load failure', () => {
    state.isError = true;
    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByRole('alert')).toHaveTextContent('error');
    expect(screen.getByRole('button', { name: 'retry' })).toBeVisible();
  });
});
