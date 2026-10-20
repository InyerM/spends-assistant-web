import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/lib/api/queries/fx-reference.queries', () => ({
  useFxReference: () => ({
    data: {
      rate: 4000,
      date: '2026-09-01',
      approximate: true,
      source_url: 'https://www.datos.gov.co/',
    },
    isPending: false,
  }),
}));
import { StatementFundingAccount } from '@/components/documents/statement-funding-account';
it('offers a labeled reference estimate while keeping the actual source amount editable', () => {
  const onAmount = vi.fn();
  render(
    <StatementFundingAccount
      accounts={[{ id: 'bank', name: 'Bank', currency: 'COP', is_active: true } as never]}
      value='bank'
      onChange={vi.fn()}
      disabled={false}
      currency='USD'
      amount={5}
      date='2026-09-01'
      fundingAmount=''
      onFundingAmount={onAmount}
    />,
  );
  expect(onAmount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'useEstimate' }));
  expect(onAmount).toHaveBeenCalledWith('20000.00');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'debitedAmount' }), {
    target: { value: '20500' },
  });
  expect(onAmount).toHaveBeenCalledWith('20500');
  expect(screen.getByText('reviewDebit')).toBeVisible();
});
