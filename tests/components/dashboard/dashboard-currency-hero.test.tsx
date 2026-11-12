import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardCurrencyHero } from '@/components/dashboard/dashboard-currency-hero';
import type { Account } from '@/types';

const state = vi.hoisted(() => ({ accounts: [] as Account[], isLoading: false }));
vi.mock('@/lib/api/queries/account.queries', () => ({
  useAccounts: () => ({ data: state.accounts, isLoading: state.isLoading }),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: vi.fn(), configurable: true });
Object.defineProperty(window, 'matchMedia', {
  value: () => ({ matches: true }),
  configurable: true,
});
afterEach(cleanup);

it('shows currency navigation on Home and changes the selected native balance', () => {
  state.accounts = [
    { currency: 'COP', balance: 80000, is_active: true },
    { currency: 'USD', balance: 5, is_active: true },
  ] as Account[];
  const onCurrencyChange = vi.fn();
  const balances = state.accounts.map((account) => ({ ...account, id: account.currency }));
  const view = render(
    <DashboardCurrencyHero
      balances={balances}
      currency='COP'
      onCurrencyChange={onCurrencyChange}
    />,
  );
  expect(screen.getByRole('region', { name: 'currencyBalances' })).toBeVisible();
  const usd = screen.getByRole('button', { name: 'balanceCurrency: USD' });
  fireEvent.click(usd);
  expect(onCurrencyChange).toHaveBeenCalledWith('USD');
  view.rerender(
    <DashboardCurrencyHero
      balances={balances}
      currency='USD'
      onCurrencyChange={onCurrencyChange}
    />,
  );
  expect(usd).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('USD');
  state.accounts = state.accounts.slice(0, 1);
  view.rerender(
    <DashboardCurrencyHero
      balances={balances.slice(0, 1)}
      currency='USD'
      onCurrencyChange={onCurrencyChange}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('COP');
});

it('leaves account setup to onboarding when no account exists', () => {
  state.accounts = [];
  render(<DashboardCurrencyHero balances={[]} currency='COP' onCurrencyChange={vi.fn()} />);
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
