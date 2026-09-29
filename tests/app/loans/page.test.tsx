import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoansPage from '@/app/(dashboard)/loans/page';

describe('manual loan ledger', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(cleanup);
  it('requires review before creating a lender record', async () => {
    const user = userEvent.setup();
    render(<LoansPage />);
    await screen.findByText('No loans yet');
    await user.type(screen.getByLabelText('Loan name'), 'Sourced loan');
    await user.type(screen.getByLabelText('Currency'), 'COP');
    await user.type(screen.getByLabelText('Money decimal places'), '0');
    await user.type(screen.getByLabelText('Evidence reference'), 'Statement page 1');
    await user.type(screen.getByLabelText('Evidence date'), '2026-09-28');
    await user.click(screen.getByRole('button', { name: 'Review entry' }));
    expect(screen.getByText('Review before saving')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByLabelText('I checked these details against the evidence'));
    await user.click(screen.getByRole('button', { name: 'Confirm reviewed entry' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/loans',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('previews exact sourced payment allocation before the RPC', async () => {
    const loanId = '00000000-0000-4000-8000-000000000222';
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: loanId,
            lender: 'bancolombia',
            label: 'Statement loan',
            currency: 'COP',
            money_scale: 0,
            opening_recorded: true,
            outstanding_minor: '100000',
            interest_expense_minor: '0',
            insurance_expense_minor: '0',
            fee_expense_minor: '0',
          },
        ],
      }),
    });
    const user = userEvent.setup();
    render(<LoansPage />);
    await screen.findByText('Statement loan');
    await user.selectOptions(screen.getByLabelText('Entry type'), 'payment');
    await user.selectOptions(screen.getByLabelText('Loan'), loanId);
    for (const [label, amount] of [
      ['Entry date', '2026-09-28'],
      ['Cash paid', '12345'],
      ['Principal paid', '10000'],
      ['Interest paid', '2000'],
      ['Insurance paid', '300'],
      ['Fees paid', '45'],
      ['Evidence reference', 'Statement row 4'],
      ['Evidence date', '2026-09-28'],
    ])
      await user.type(screen.getByLabelText(label), amount);
    await user.click(screen.getByRole('button', { name: 'Review entry' }));
    expect(screen.getByText(/principal 10000 COP; interest 2000 COP/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByLabelText('I checked these details against the evidence'));
    await user.click(screen.getByRole('button', { name: 'Confirm reviewed entry' }));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.event).toMatchObject({
      cash_paid_minor: '12345',
      principal_minor: '10000',
      interest_minor: '2000',
      insurance_minor: '300',
      fee_minor: '45',
    });
  });
});
