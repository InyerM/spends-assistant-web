import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentsPage from '@/app/(dashboard)/investments/page';

vi.mock('next-intl', async () => {
  const messages = (await import('@/messages/wealth.en.json')).default;
  return {
    useLocale: () => 'en',
    useTranslations:
      () =>
      (key: string, values?: Record<string, string | number>): string => {
        const message = (messages.investments as Record<string, string>)[key] ?? key;
        return Object.entries(values ?? {}).reduce(
          (result, [name, value]) => result.replace(`{${name}}`, String(value)),
          message,
        );
      },
  };
});

describe('manual investment tracker', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(cleanup);

  it('shows a review step before persisting a new position', async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await screen.findByText('No positions yet');
    await user.type(screen.getByLabelText('Symbol or fund'), 'BTC');
    await user.type(screen.getByLabelText('Quote unit'), 'USDT');
    await user.type(screen.getByLabelText('Quantity decimal places'), '18');
    await user.type(screen.getByLabelText('Money decimal places'), '6');
    await user.type(screen.getByLabelText('Evidence reference'), 'Exchange statement');
    await user.type(screen.getByLabelText('Evidence date'), '2026-09-28');
    await user.click(screen.getByRole('button', { name: 'Review entry' }));

    expect(screen.getByText('Review before saving')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByLabelText('I checked these details against the evidence'));
    await user.click(screen.getByRole('button', { name: 'Confirm reviewed entry' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/investments',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('keeps a fully sold position in the history tab with its events', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: '00000000-0000-4000-8000-000000000333',
            provider: 'tyba',
            symbol: 'Past fund',
            quote_currency: 'COP',
            quantity_scale: 0,
            money_scale: 0,
            quantity_atoms: '0',
            cost_basis_minor: '0',
            realized_return_minor: '15000',
            investment_trades: [
              {
                id: 'trade-1',
                kind: 'sell',
                occurred_on: '2026-09-28',
                quantity_atoms: '1',
                gross_minor: '1015000',
              },
            ],
          },
        ],
      }),
    });
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await screen.findByText(/No current positions/);
    expect(screen.queryByText('Past fund')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /History \(1\)/ }));
    expect(screen.getByText('Past fund')).toBeInTheDocument();
    expect(screen.getByText('Recorded events (1)')).toBeInTheDocument();
  });

  it('treats zero opening basis as a reviewed known value', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: '00000000-0000-4000-8000-000000000222',
            provider: 'binance',
            symbol: 'BTC',
            quote_currency: 'USDT',
            quantity_scale: 18,
            money_scale: 6,
            quantity_atoms: '0',
            cost_basis_minor: '0',
            realized_return_minor: '0',
          },
        ],
      }),
    });
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await screen.findByText('BTC');
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Entry type'), 'opening');
    await user.selectOptions(
      screen.getByLabelText('Position'),
      '00000000-0000-4000-8000-000000000222',
    );
    await user.type(screen.getByLabelText('Trade date'), '2026-09-28');
    await user.type(screen.getByLabelText(/Quantity/), '1');
    await user.type(screen.getByLabelText('Known cost basis (leave blank if unknown) (USDT)'), '0');
    await user.type(screen.getByLabelText('Evidence reference'), 'Broker report');
    await user.type(screen.getByLabelText('Evidence date'), '2026-09-28');
    await user.click(screen.getByRole('button', { name: 'Review entry' }));
    expect(screen.queryByText('Review before saving')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('I verified the opening cost basis is exactly zero'));
    await user.click(screen.getByRole('button', { name: 'Review entry' }));
    expect(screen.getByText('Review before saving')).toBeInTheDocument();
  });

  it('stops review of a trade dated before the latest saved trade', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: '00000000-0000-4000-8000-000000000222',
            provider: 'binance',
            symbol: 'BTC',
            quote_currency: 'USDT',
            quantity_scale: 0,
            money_scale: 0,
            quantity_atoms: '10',
            cost_basis_minor: '1000',
            realized_return_minor: '0',
            investment_trades: [{ id: 'trade-1', occurred_on: '2026-09-29' }],
          },
        ],
      }),
    });
    const user = userEvent.setup();
    render(<InvestmentsPage />);
    await screen.findByText('BTC');
    await user.selectOptions(screen.getByLabelText('Entry type'), 'sell');
    await user.selectOptions(
      screen.getByLabelText('Position'),
      '00000000-0000-4000-8000-000000000222',
    );
    await user.type(screen.getByLabelText('Trade date'), '2026-09-28');
    await user.type(screen.getByLabelText(/Quantity/), '5');
    await user.type(screen.getByLabelText('Gross amount (USDT)'), '700');
    await user.type(screen.getByLabelText('Evidence reference'), 'Broker report');
    await user.type(screen.getByLabelText('Evidence date'), '2026-09-28');
    await user.click(screen.getByRole('button', { name: 'Review entry' }));

    expect(screen.getByRole('alert')).toHaveTextContent('2026-09-29');
    expect(screen.queryByText('Review before saving')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
