import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/accounts',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { email: 'test@example.com', user_metadata: {} }, signOut: vi.fn() }),
}));
vi.mock('@/lib/api/queries/email-forwarding.queries', () => ({
  useEmailForwardingRoute: () => ({ data: { status: 'active', user_confirmed_at: 'today' } }),
}));
vi.mock('@/store/ui-store', () => ({
  useUiStore: (selector: (state: object) => unknown) =>
    selector({ sidebarCollapsed: false, toggleSidebarCollapsed: vi.fn() }),
}));
vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({ data: { plan: 'free' } }),
}));
vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => ({ data: { ai_parses_used: 4, ai_parses_limit: 15 } }),
}));

describe('Sidebar navigation', () => {
  afterEach(cleanup);
  it('keeps dashboard and transactions visible while grouping the rest', () => {
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'transactions' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'wealthGroup' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'accounts' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'wealthGroup' }));
    expect(screen.getByRole('button', { name: 'wealthGroup' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'accounts' })).not.toBeInTheDocument();
  });

  it('shows actual plan usage without a trial or purchase claim', () => {
    render(<Sidebar />);
    expect(screen.getByText(/planLabel · free/)).toBeVisible();
    expect(screen.getByText('4 / 15')).toBeVisible();
    expect(screen.getByRole('button', { name: 'viewUsage' })).toBeVisible();
    expect(screen.queryByText(/trial|upgrade/i)).not.toBeInTheDocument();
  });
});
