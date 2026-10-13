import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import EmailInboxPage from '@/app/(dashboard)/inbox/page';

const { route } = vi.hoisted(() => ({ route: vi.fn() }));

vi.mock('@/lib/api/queries/email-forwarding.queries', () => ({ useEmailForwardingRoute: route }));
vi.mock('@/app/(dashboard)/transactions/shortcut-inbox/page', () => ({
  default: ({ source }: { source?: string }) => (
    <div data-testid='inbox-list'>{source ?? 'all-sources'}</div>
  ),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('email inbox page', () => {
  afterEach(() => cleanup());

  it('keeps shortcuts review available before forwarding verification', () => {
    route.mockReturnValue({
      data: { status: 'active', user_confirmed_at: null },
      isLoading: false,
    });
    render(<EmailInboxPage />);
    expect(screen.getByTestId('inbox-list')).toHaveTextContent('all-sources');
  });

  it('opens the owner inbox after verification', () => {
    route.mockReturnValue({
      data: { status: 'active', user_confirmed_at: '2026-10-03T17:00:00Z' },
      isLoading: false,
    });
    render(<EmailInboxPage />);
    expect(screen.getByTestId('inbox-list')).toHaveTextContent('all-sources');
  });
});
