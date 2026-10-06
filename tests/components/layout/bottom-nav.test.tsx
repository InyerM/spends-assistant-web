import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { BottomNav } from '@/components/layout/bottom-nav';
import es from '@/messages/es.json';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
let verified = true;
vi.mock('@/lib/api/queries/email-forwarding.queries', () => ({
  useEmailForwardingRoute: () => ({
    data: verified
      ? { status: 'active', user_confirmed_at: '2026-10-03T17:58:04Z' }
      : { status: 'active', user_confirmed_at: null },
  }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/receivables',
  useRouter: () => ({ push }),
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: null, signOut: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  verified = true;
});

describe('mobile workspace navigation', () => {
  it.each([
    ['receivables', '/receivables'],
    ['reliefFunds', '/relief-funds'],
    ['emailInbox', '/inbox'],
    ['help', '/help'],
  ] as const)('exposes and opens %s in the More sheet', (key, href) => {
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: es.nav.more }));
    expect(screen.getByRole('button', { name: es.nav.receivables })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: es.nav.reliefFunds })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: es.nav[key] }));
    expect(push).toHaveBeenCalledWith(href);
  });
  it('keeps the title and close control outside the scrolling navigation area', () => {
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: es.nav.more }));
    const sheet = screen.getByRole('dialog');
    const scrollArea = screen.getByRole('button', { name: es.common.signOut }).parentElement;
    expect(sheet).toHaveClass('max-h-[calc(100dvh-1rem)]', 'overflow-hidden');
    expect(scrollArea).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
      'pb-[max(1rem,env(safe-area-inset-bottom))]',
    );
    expect(scrollArea).not.toContainElement(screen.getByRole('heading', { name: es.nav.more }));
    expect(scrollArea).not.toContainElement(screen.getByRole('button', { name: 'Close' }));
  });
  it('keeps the email inbox unavailable before forwarding verification', () => {
    verified = false;
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: es.nav.more }));
    expect(screen.queryByRole('button', { name: es.nav.emailInbox })).not.toBeInTheDocument();
  });
});
