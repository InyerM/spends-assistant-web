import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PeriodSelector } from '@/components/transactions/period-selector';

vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
afterEach(cleanup);

it('opens the existing period picker from an unfiltered range without an invalid date', () => {
  const onChange = vi.fn();
  render(
    <PeriodSelector dateFrom='' dateTo='' emptyLabel='Todas las fechas' onChange={onChange} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Todas las fechas' }));
  expect(screen.getByRole('tab', { name: 'periodMonths' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ene' }));
  expect(onChange).toHaveBeenCalledWith(
    expect.stringMatching(/^\d{4}-01-01$/u),
    expect.stringMatching(/^\d{4}-01-31$/u),
  );
});
