import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ShortcutInboxPage from '@/app/(dashboard)/transactions/shortcut-inbox/page';

const { useTranslations } = vi.hoisted(() => {
  const translate = (key: string): string =>
    ({
      title: 'Shortcut inbox',
      markNonTransaction: 'Mark non-transaction',
      dismiss: 'Dismiss',
      exportJson: 'Export JSON',
      showCandidates: 'Show possible matches',
      hideCandidates: 'Hide possible matches',
      possibleMatch: 'Possible match',
      sameAmountDateAccount: 'Same amount, date, and account',
      reviewMatch: 'Review this match',
      acknowledgeMatch: 'Acknowledge existing transaction',
      cancelMatch: 'Cancel match review',
      matched: 'Matched existing transaction',
      matchedTransaction: 'Linked transaction',
      createNew: 'Create new transaction',
      createAccount: 'Account',
      createCategory: 'Category',
      createAmount: 'Amount',
      createDescription: 'Description',
      saveReviewed: 'Save reviewed transaction',
      confirmDistinct: 'Create distinct payment',
      overflowCaution: 'Too many possible matches',
    })[key] ?? key;
  return { useTranslations: vi.fn(() => translate) };
});

vi.mock('next-intl', () => ({ useTranslations }));

describe('Shortcut inbox review page', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows private intake text with reversible review actions and no confirmation action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'item-1',
              source: 'sms-shortcut',
              external_id: null,
              received_at: '2026-09-29T10:00:00Z',
              raw_text: 'Synthetic private message',
              status: 'pending',
              created_at: '2026-09-29T10:01:00Z',
            },
          ],
          count: 1,
        }),
      ),
    );
    render(<ShortcutInboxPage />);
    await waitFor(() => expect(screen.getByText('Synthetic private message')).toBeInTheDocument());
    expect(useTranslations).toHaveBeenCalledWith('shortcutInbox');
    expect(screen.getByRole('button', { name: 'Mark non-transaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm transaction/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export JSON' })).toHaveAttribute(
      'href',
      '/api/shortcut-inbox/export',
    );
  });

  it('shows bounded candidate evidence on request without offering confirmation', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.endsWith('/candidates')
            ? {
                evidence: { amount: '119000.00', date: '2024-11-23', account: 'unique' },
                candidates: [
                  {
                    id: 'tx-1',
                    date: '2024-11-23',
                    amount: 119000,
                    description: 'Synthetic existing transaction',
                    type: 'expense',
                    source: 'web',
                    strength: 'possible',
                    signals: ['same_amount_date_account'],
                  },
                ],
                at_limit: false,
              }
            : {
                data: [
                  {
                    id: 'item-1',
                    source: 'sms-shortcut',
                    external_id: null,
                    received_at: '2026-09-29T10:00:00Z',
                    raw_text: 'Synthetic private message',
                    status: 'pending',
                    created_at: '2026-09-29T10:01:00Z',
                  },
                ],
                count: 1,
              },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ShortcutInboxPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show possible matches' }));
    expect(await screen.findByText('Synthetic existing transaction')).toBeInTheDocument();
    expect(screen.getByText('Possible match')).toBeInTheDocument();
    expect(screen.getByText('Same amount, date, and account')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/shortcut-inbox/item-1/candidates', {
      cache: 'no-store',
    });
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
  });

  it('requires a separate acknowledgement click after reviewing a candidate', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/candidates'))
        return Promise.resolve(
          Response.json({
            evidence: { amount: '119000.00', date: '2024-11-23', account: 'unique' },
            candidates: [
              {
                id: 'tx-1',
                date: '2024-11-23',
                amount: 119000,
                description: 'Synthetic existing transaction',
                type: 'expense',
                source: 'web',
                strength: 'possible',
                signals: ['same_amount_date_account'],
              },
            ],
            at_limit: false,
          }),
        );
      if (url.endsWith('/match'))
        return Promise.resolve(Response.json({ decision_id: 'decision-1' }));
      const matched = url.includes('status=matched');
      return Promise.resolve(
        Response.json({
          data: matched
            ? [
                {
                  id: 'item-1',
                  source: 'sms-shortcut',
                  external_id: null,
                  received_at: '2026-09-29T10:00:00Z',
                  raw_text: 'Synthetic private message',
                  status: 'matched',
                  created_at: '2026-09-29T10:01:00Z',
                  match: { decision_id: 'decision-1', transaction_id: 'tx-1' },
                },
              ]
            : [
                {
                  id: 'item-1',
                  source: 'sms-shortcut',
                  external_id: null,
                  received_at: '2026-09-29T10:00:00Z',
                  raw_text: 'Synthetic private message',
                  status: 'pending',
                  created_at: '2026-09-29T10:01:00Z',
                },
              ],
          count: 1,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ShortcutInboxPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show possible matches' }));
    expect(await screen.findByText('Synthetic existing transaction')).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/match')),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Review this match' }));
    expect(
      fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/match')),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge existing transaction' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/shortcut-inbox/item-1/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: 'tx-1' }),
      }),
    );
    expect(await screen.findByText('Linked transaction: tx-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark non-transaction' })).not.toBeInTheDocument();
  });

  it('requires reviewed fields and a second explicit decision when the database finds a same-value transaction', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/accounts')
        return Promise.resolve(Response.json([{ id: 'account-1', name: 'Cash' }]));
      if (url === '/api/categories')
        return Promise.resolve(
          Response.json([{ id: 'category-1', name: 'Food', type: 'expense' }]),
        );
      if (url.endsWith('/create')) {
        const body = JSON.parse(init?.body as string) as Record<string, unknown>;
        if (!body.confirm_distinct)
          return Promise.resolve(
            Response.json(
              {
                status: 'review_required',
                candidate_hash: 'a'.repeat(32),
                candidate_count: 1,
                candidates: [
                  {
                    id: 'tx-1',
                    date: '2026-09-28',
                    amount: 1200.5,
                    description: 'Existing payment',
                    source: 'web',
                  },
                ],
              },
              { status: 409 },
            ),
          );
        return Promise.resolve(
          Response.json(
            {
              status: 'created',
              transaction_id: 'tx-2',
              decision_id: 'decision-2',
              replayed: false,
            },
            { status: 201 },
          ),
        );
      }
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: 'item-1',
              source: 'sms-shortcut',
              external_id: 'receipt-1',
              received_at: '2026-09-29T10:00:00Z',
              raw_text: 'Synthetic private message',
              status: 'pending',
              created_at: '2026-09-29T10:01:00Z',
            },
          ],
          count: 1,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ShortcutInboxPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create new transaction' }));
    expect(
      fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/create')),
    ).toBe(false);
    expect(await screen.findByRole('option', { name: 'Food' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'category-1' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200.50' } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Reviewed market expense' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed transaction' }));
    expect(await screen.findByText(/Existing payment/u)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => typeof url === 'string' && url.endsWith('/create')),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Create distinct payment' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) => typeof url === 'string' && url.endsWith('/create')),
      ).toHaveLength(2),
    );
    const createCalls = fetchMock.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.endsWith('/create'),
    );
    expect(JSON.parse(createCalls.at(-1)?.[1]?.body as string)).toMatchObject({
      amount: '1200.50',
      category_id: 'category-1',
      confirm_distinct: true,
      reviewed_candidate_hash: 'a'.repeat(32),
    });
  });

  it('shows a bounded candidate overflow and does not offer creation', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/accounts')
        return Promise.resolve(Response.json([{ id: 'account-1', name: 'Cash' }]));
      if (url === '/api/categories')
        return Promise.resolve(
          Response.json([{ id: 'category-1', name: 'Food', type: 'expense' }]),
        );
      if (url.endsWith('/create'))
        return Promise.resolve(
          Response.json(
            {
              status: 'review_overflow',
              candidate_count: 21,
              candidates: [
                {
                  id: 'tx-1',
                  date: '2026-09-28',
                  amount: '1200.50',
                  description: 'Existing payment',
                  source: 'web',
                },
              ],
            },
            { status: 409 },
          ),
        );
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: 'item-1',
              source: 'sms-shortcut',
              external_id: 'receipt-1',
              received_at: '2026-09-29T10:00:00Z',
              raw_text: 'Synthetic private message',
              status: 'pending',
              created_at: '2026-09-29T10:01:00Z',
            },
          ],
          count: 1,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ShortcutInboxPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create new transaction' }));
    expect(await screen.findByRole('option', { name: 'Food' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: 'account-1' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'category-1' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200.50' } });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Reviewed expense' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed transaction' }));
    expect(await screen.findByText('Too many possible matches')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create distinct payment' }),
    ).not.toBeInTheDocument();
  });
});
