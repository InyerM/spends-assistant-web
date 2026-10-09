import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/sidebar';

vi.mock('@/lib/api/queries/notifications.queries', () => ({
  useNotifications: () => ({ data: undefined }),
}));
vi.mock('@/components/notifications/notification-center', () => ({
  NotificationCenter: () => null,
}));

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
const uiState = vi.hoisted(() => ({ sidebarCollapsed: false, toggleSidebarCollapsed: vi.fn() }));
vi.mock('@/store/ui-store', () => ({
  useUiStore: (selector: (state: object) => unknown) => selector(uiState),
}));
const subscription = vi.hoisted(() => ({ plan: 'free' }));
vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({ data: subscription }),
}));
vi.mock('@/hooks/use-usage', () => ({
  useUsage: () => ({ data: { ai_parses_used: 4, ai_parses_limit: 15 } }),
}));

describe('Sidebar navigation', () => {
  afterEach(() => {
    cleanup();
    subscription.plan = 'free';
    uiState.sidebarCollapsed = false;
  });
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

  it('keeps the collapse control inside the brand header with a full touch target', () => {
    render(<Sidebar />);
    const control = screen.getByRole('button', { name: 'collapseSidebar' });
    expect(control.closest('header')).not.toBeNull();
    expect(control).toHaveClass('h-11', 'w-11');
    expect(control).not.toHaveClass('absolute');
  });

  it('keeps the expand control visible when collapsed', () => {
    uiState.sidebarCollapsed = true;
    render(<Sidebar />);
    const control = screen.getByRole('button', { name: 'expandSidebar' });
    expect(control).toHaveAttribute('aria-expanded', 'false');
    expect(control.closest('header')).not.toBeNull();
    fireEvent.click(control);
    expect(uiState.toggleSidebarCollapsed).toHaveBeenCalled();
  });

  it('uses the mobile drawer close flow without another collapse control', () => {
    render(<Sidebar onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'collapseSidebar' })).not.toBeInTheDocument();
  });

  it('does not present a Free quota as a limit for Pro', () => {
    subscription.plan = 'pro';
    render(<Sidebar />);
    expect(screen.getByText(/planLabel · pro/)).toBeVisible();
    expect(screen.queryByText('4 / 15')).not.toBeInTheDocument();
    expect(screen.getByText('unlimitedAi')).toBeVisible();
  });

  it('shows actual plan usage without a trial or purchase claim', () => {
    render(<Sidebar />);
    expect(screen.getByText(/planLabel · free/)).toBeVisible();
    expect(screen.getByText('4 / 15')).toBeVisible();
    expect(screen.getByRole('button', { name: 'viewUsage' })).toBeVisible();
    expect(screen.queryByText(/trial|upgrade/i)).not.toBeInTheDocument();
  });
});
