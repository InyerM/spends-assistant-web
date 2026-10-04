import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { BottomNav } from '@/components/layout/bottom-nav';
import es from '@/messages/es.json';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/receivables',
  useRouter: () => ({ push }),
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: null, signOut: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('mobile workspace navigation', () => {
  it.each([
    ['receivables', '/receivables'],
    ['reliefFunds', '/relief-funds'],
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
});
