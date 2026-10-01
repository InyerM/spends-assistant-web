import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReceivablesPage from '@/app/(dashboard)/receivables/page';

vi.mock('next-intl', async () => {
  const messages = (await import('@/messages/wealth.en.json')).default;
  return {
    useLocale: () => 'en',
    useTranslations:
      () =>
      (key: string): string =>
        (messages.receivables as Record<string, string>)[key] ?? key,
  };
});

const loanId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const transactionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('personal receivables review', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/transactions?'))
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: transactionId,
                date: '2026-05-19',
                amount: 100000,
                type: 'income',
                description: 'Transfer received from brother',
              },
            ],
          }),
        };
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id: loanId,
              borrower: 'Brother',
              label: 'May personal loan',
              currency: 'COP',
              money_scale: 0,
              outstanding_minor: '800000',
              personal_receivable_events: [],
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(cleanup);

  it('requires review and an exact existing income transaction for a principal repayment', async () => {
    const user = userEvent.setup();
    render(<ReceivablesPage />);
    await screen.findByText('May personal loan');
    await user.selectOptions(screen.getByLabelText('Entry type'), 'repayment');
    await user.selectOptions(screen.getByLabelText('Receivable'), loanId);
    await user.type(screen.getByLabelText('Event date'), '2026-05-19');
    await user.click(screen.getByRole('button', { name: 'Find bank transaction' }));
    await screen.findByText(/Transfer received from brother/);
    await user.selectOptions(screen.getByLabelText('Source transaction'), transactionId);
    await user.type(screen.getByLabelText('Principal amount'), '100000');
    await user.type(
      screen.getByLabelText('Evidence reference'),
      'Owner-confirmed principal repayment',
    );
    await user.click(screen.getByRole('button', { name: 'Review entry' }));
    expect(screen.getByText(/Remaining principal: 700,000 COP/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await user.click(screen.getByLabelText('I checked this against the transaction and evidence'));
    await user.click(screen.getByRole('button', { name: 'Confirm reviewed entry' }));
    const [, options] = (fetchMock.mock.calls as [string, RequestInit?][]).find(
      ([url, opts]) => url === '/api/receivables' && opts?.method === 'POST',
    )!;
    const body = JSON.parse(options!.body as string);
    expect(body.event).toMatchObject({
      action: 'repayment',
      receivable_id: loanId,
      source_transaction_id: transactionId,
      occurred_on: '2026-05-19',
      amount_minor: '100000',
    });
  });

  it('does not invent principal when creating a borrower record', async () => {
    const user = userEvent.setup();
    render(<ReceivablesPage />);
    await screen.findByText('May personal loan');
    await user.type(screen.getByLabelText('Borrower'), 'Kevin Carmona');
    await user.type(screen.getByLabelText('Loan label'), 'March personal loan');
    await user.type(screen.getByLabelText('Currency'), 'COP');
    await user.type(screen.getByLabelText('Decimal places'), '0');
    await user.click(screen.getByRole('button', { name: 'Review entry' }));
    expect(screen.getByText(/No principal recorded yet/)).toBeInTheDocument();
  });
});
