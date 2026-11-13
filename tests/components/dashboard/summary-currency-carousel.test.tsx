import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import type { Transaction } from '@/types';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { currency: string }) =>
    values ? `${key}:${values.currency}` : key,
  useLocale: () => 'en',
}));
afterEach(cleanup);
const transactions = [
  { type: 'income', amount: 100, currency: 'USD' },
  { type: 'expense', amount: 125, currency: 'USD' },
  { type: 'income', amount: 90000, currency: 'COP' },
] as Transaction[];
it('embeds currency navigation in cash flow and preserves its negative sign', () => {
  const change = vi.fn();
  render(
    <SummaryCards
      currency='USD'
      currencies={['COP', 'USD', 'EUR']}
      onCurrencyChange={change}
      transactions={transactions}
    />,
  );
  const card = screen.getByRole('region', { name: 'cashFlow' });
  expect(within(card).getByText('-$25')).toBeVisible();
  expect(within(card).getByText('USD')).toBeVisible();
  expect(within(card).getByRole('button', { name: 'currencyPage:USD' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  fireEvent.click(within(card).getByRole('button', { name: 'next' }));
  expect(change).toHaveBeenLastCalledWith('EUR');
  fireEvent.keyDown(card, { key: 'Home' });
  expect(change).toHaveBeenLastCalledWith('COP');
  fireEvent.touchStart(card, { touches: [{ clientX: 180, clientY: 100 }] });
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: 60, clientY: 105 }] });
  expect(change).toHaveBeenLastCalledWith('EUR');
  change.mockClear();
  fireEvent.touchStart(card, { touches: [{ clientX: 180, clientY: 100 }] });
  fireEvent.touchEnd(card, { changedTouches: [{ clientX: 170, clientY: 220 }] });
  expect(change).not.toHaveBeenCalled();
});
it('does not show paging for one currency and does not show stale amounts while loading', () => {
  const view = render(
    <SummaryCards
      currency='USD'
      currencies={['USD']}
      onCurrencyChange={vi.fn()}
      transactions={transactions}
    />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.rerender(
    <SummaryCards
      currency='USD'
      currencies={['COP', 'USD']}
      onCurrencyChange={vi.fn()}
      transactions={transactions}
      isLoading
    />,
  );
  expect(screen.queryByText('-$25')).not.toBeInTheDocument();
});
