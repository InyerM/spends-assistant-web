import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Account } from '@/types';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}));
vi.mock('@/lib/api/queries/account-activity.queries', () => ({
  useAccountActivity: () => ({
    isPending: false,
    data: {
      income: 0,
      expenses: 0,
      transfers_in: 5,
      transfers_out: 0,
      count: 1,
      categories: [],
      months: [{ month: '2026-09', income: 0, expenses: 0, transfers_in: 5, transfers_out: 0 }],
      period_start: '2026-05-01',
      period_end: '2026-10-20',
    },
  }),
}));
import { AccountOverview } from '@/components/accounts/account-overview';
it('shows the card payment separately from income and gives it a visible monthly bar', () => {
  const { container } = render(
    <AccountOverview account={{ id: 'usd', type: 'credit_card', currency: 'USD' } as Account} />,
  );
  expect(screen.getAllByText('paymentsReceived').length).toBeGreaterThan(0);
  expect(container.querySelector('[data-flow="transfers_in"]')).toHaveStyle({ height: '100%' });
  expect(screen.getByText('cardTransferHint')).toBeVisible();
});
