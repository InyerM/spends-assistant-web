import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@/components/ui/date-picker';

describe('DatePicker locale', () => {
  it('shows Spanish month names in the selected date and calendar when the app locale is Spanish', () => {
    render(
      <NextIntlClientProvider locale='es' messages={{}}>
        <DatePicker value='2024-09-15' onChange={vi.fn()} ariaLabel='Fecha' />
      </NextIntlClientProvider>,
    );

    const picker = screen.getByRole('button', { name: 'Fecha' });
    expect(picker).toHaveTextContent('15 sep 2024');
    fireEvent.click(picker);
    expect(screen.getByText(/septiembre 2024/i)).toBeInTheDocument();
  });

  it('keeps English month names when the app locale is English', () => {
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <DatePicker value='2024-09-15' onChange={vi.fn()} ariaLabel='Date' />
      </NextIntlClientProvider>,
    );

    const picker = screen.getByRole('button', { name: 'Date' });
    expect(picker).toHaveTextContent(/Sep/i);
    fireEvent.click(picker);
    expect(screen.getByText(/September 2024/i)).toBeInTheDocument();
  });
});
