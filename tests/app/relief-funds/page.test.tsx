import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReliefFundsPage from '@/app/(dashboard)/relief-funds/page';

vi.mock('next-intl', async () => {
  const messages = (await import('@/messages/wealth.en.json')).default;
  return {
    useLocale: () => 'en',
    useTranslations:
      () =>
      (key: string, values?: Record<string, string | number>): string => {
        const message = (messages.reliefFunds as Record<string, string>)[key] ?? key;
        return Object.entries(values ?? {}).reduce(
          (result, [name, value]) => result.replace(`{${name}}`, String(value)),
          message,
        );
      },
  };
});

const fundId = '11111111-1111-4111-8111-111111111111';
const savedFund = {
  id: fundId,
  title: 'August 2026 emergency relief',
  purpose: 'Community supply purchases',
  currency: 'COP',
  relief_fund_entries: [
    {
      id: 'r1',
      kind: 'receipt',
      occurred_on: '2026-08-14',
      amount_minor: '25000000',
      description: 'Donation',
      source_kind: 'bank_notice',
      source_reference: 'Owner confirmed',
    },
    {
      id: 'r2',
      kind: 'unknown_spend',
      occurred_on: null,
      amount_minor: null,
      description: 'Cash purchases, amount unknown',
      source_kind: 'manual_recollection',
      source_reference: 'Owner recollection',
    },
  ],
};

describe('relief fund journal page', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [savedFund] }) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(cleanup);

  it('shows a known remainder warning when spending has no confirmed amount', async () => {
    render(<ReliefFundsPage />);
    expect(await screen.findByText('August 2026 emergency relief')).toBeInTheDocument();
    expect(screen.getByText(/Actual remainder unknown/)).toBeInTheDocument();
    expect(screen.getByText(/Known receipts minus known outlays/)).toBeInTheDocument();
    expect(screen.getByText('Cash purchases, amount unknown')).toBeInTheDocument();
    expect(screen.getByText('Date unknown')).toBeInTheDocument();
  });

  it('reviews an unknown cash purchase without a fabricated amount', async () => {
    const user = userEvent.setup();
    render(<ReliefFundsPage />);
    await screen.findByText('August 2026 emergency relief');
    await user.click(screen.getByRole('combobox', { name: 'Entry type' }));
    await user.click(screen.getByRole('option', { name: 'Spend, amount unknown' }));
    await user.click(screen.getByRole('combobox', { name: 'Fund' }));
    await user.click(screen.getByRole('option', { name: 'August 2026 emergency relief' }));
    expect(screen.getByLabelText('Date (optional)')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Description'), 'Other cash purchases');
    await user.type(screen.getByLabelText('Source reference'), 'Owner recollection');
    await user.click(screen.getByRole('button', { name: 'Review entry' }));
    expect(screen.getByText('Review before saving')).toBeInTheDocument();
    expect(screen.queryByLabelText('Exact amount (COP)')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('I checked this against the source'));
    await user.click(screen.getByRole('button', { name: 'Confirm reviewed entry' }));
    const post = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
    expect(post).toBeDefined();
    const body = JSON.parse(post![1].body as string) as { event: Record<string, unknown> };
    expect(body.event).toMatchObject({
      kind: 'unknown_spend',
      amount_minor: null,
      occurred_on: null,
      transaction_id: null,
    });
  });
});
