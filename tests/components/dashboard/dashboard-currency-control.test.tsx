import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardCurrencyControl } from '@/components/dashboard/dashboard-currency-control';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
afterEach(cleanup);
const balances = [
  { id: 'COP', currency: 'COP', balance: 80000 },
  { id: 'USD', currency: 'USD', balance: 5 },
  { id: 'EUR', currency: 'EUR', balance: 3 },
];

it('changes the shared currency without adding another balance card', () => {
  const onCurrencyChange = vi.fn();
  const view = render(
    <DashboardCurrencyControl
      balances={balances}
      currency='COP'
      onCurrencyChange={onCurrencyChange}
    />,
  );
  expect(screen.getByRole('group', { name: 'displayCurrency' })).toBeVisible();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.queryByText(/80,000/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'back' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'next' }));
  expect(onCurrencyChange).toHaveBeenLastCalledWith('USD');
  view.rerender(
    <DashboardCurrencyControl
      balances={balances}
      currency='USD'
      onCurrencyChange={onCurrencyChange}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('USD');
  fireEvent.keyDown(screen.getByRole('button', { name: 'next' }), { key: 'End' });
  expect(onCurrencyChange).toHaveBeenLastCalledWith('EUR');
});

it('shows the available currency without inactive navigation for a single currency', () => {
  render(
    <DashboardCurrencyControl
      balances={balances.slice(0, 1)}
      currency='USD'
      onCurrencyChange={vi.fn()}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('COP');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('does not offer currency selection before account setup', () => {
  render(<DashboardCurrencyControl balances={[]} currency='COP' onCurrencyChange={vi.fn()} />);
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
});
