import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountCorrectionsPage from '@/app/(dashboard)/transactions/account-corrections/page';

const { invalidateQueries } = vi.hoisted(() => ({ invalidateQueries: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      ({
        title: 'Review debit account',
        reviewPosting: 'Review statement posting',
        statementDocument: 'Statement document',
        statementPage: 'Statement page',
        statementLine: 'Posting line',
        postedAmount: 'Posted amount',
        confirmedEvidence: 'I checked this posting in the statement',
        applyCorrection: 'Correct account',
        noCandidates: 'No account corrections to review',
        sourceNotice: 'Original bank notice',
        currentAccount: 'Current account',
        confirmedAccount: 'Confirmed account',
        success: 'Account corrected',
      })[key] ?? key,
  useLocale: () => 'en',
}));

const candidate = {
  id: '11111111-1111-4111-8111-111111111111',
  account_id: '22222222-2222-4222-8222-222222222222',
  amount: 150000,
  date: '2026-08-03',
  time: '13:40:00',
  description: 'Purchase',
  raw_text: 'Bancolombia: Compraste COP150,000.00 con tu T.Deb *9989',
  current_account_name: 'Mastercard Gold',
  match_decision_id: '33333333-3333-4333-8333-333333333333',
};
const destination = { id: '44444444-4444-4444-8444-444444444444', name: 'Bancolombia savings' };

describe('debit account correction review page', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('requires a reviewed statement posting before calling the atomic correction route', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [candidate], destinations: [destination] }))
      .mockResolvedValueOnce(
        Response.json({ correction: { id: 'audit-1' }, replayed: false }, { status: 201 }),
      );
    vi.stubGlobal('fetch', fetch);
    render(<AccountCorrectionsPage />);
    expect(await screen.findByText('Purchase')).toBeInTheDocument();
    expect(screen.getByText('Mastercard Gold')).toBeInTheDocument();
    expect(screen.getByText('Bancolombia savings')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review statement posting' }));
    const submit = screen.getByRole('button', { name: 'Correct account' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Statement document'), {
      target: { value: 'Q3-savings.pdf' },
    });
    fireEvent.change(screen.getByLabelText('Statement page'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Posting line'), { target: { value: 'posting 42' } });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I checked this posting in the statement'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const [url, options] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/transactions/account-corrections');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      transaction_id: candidate.id,
      match_decision_id: candidate.match_decision_id,
      expected_account_id: candidate.account_id,
      expected_amount: '150000.00',
      new_account_id: destination.id,
      new_amount: null,
      evidence: { document: 'Q3-savings.pdf', page: 3, line: 'posting 42' },
    });
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/u);
    expect(await screen.findByText('Account corrected')).toBeInTheDocument();
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it('shows an empty state without a financial action when no candidates exist', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: [], destinations: [destination] }));
    vi.stubGlobal('fetch', fetch);
    render(<AccountCorrectionsPage />);
    expect(await screen.findByText('No account corrections to review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Correct account' })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
