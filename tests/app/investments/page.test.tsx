import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentsPage from '@/app/(dashboard)/investments/page';

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
});
