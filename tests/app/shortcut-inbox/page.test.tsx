import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShortcutInboxPage from '@/app/(dashboard)/transactions/shortcut-inbox/page';

const { useTranslations } = vi.hoisted(() => {
  const translate = (key: string): string =>
    ({
      title: 'Shortcut inbox',
      senderUnverified: 'Unverified sender',
      forwardedSource: 'Forwarded email',
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
      reviewReversal: 'Review incorrect match',
      reverseMatch: 'Undo match and review again',
      cancelReversal: 'Keep this match',
      reversalCaution:
        'The message returns to review, but it cannot be linked to this same transaction again. Choose a different existing transaction or create a reviewed one. The transaction and balance remain unchanged.',
      createNew: 'Create new transaction',
      createAccount: 'Account',
      createCategory: 'Category',
      createAmount: 'Amount',
      createDescription: 'Description',
      createEventTime: 'Original transaction time',
      confirmEventTime: 'I confirmed this original time',
      saveReviewed: 'Save reviewed transaction',
      confirmDistinct: 'Create distinct payment',
      overflowCaution: 'Too many possible matches',
      luloCardPurchase: 'Possible card purchase',
      luloZeroAmount: 'Zero-amount card notice',
      luloNeedsReview: 'Unrecognized Lulo notice',
      luloStructured: 'Structured text',
      luloLow: 'Incomplete text',
      luloEmailTime: 'Gmail message time',
      luloBankTime: 'Bank event time',
      luloMerchant: 'Merchant',
      luloCard: 'Card',
      luloOriginalAmount: 'Original amount',
      luloCurrencyUnknown: 'Currency unverified',
      luloEvidence: 'Source excerpts',
      luloCaution: 'Verify against the card statement before a financial decision.',
      luloZeroCaution: 'No charge inferred from a zero-amount notice.',
    })[key] ?? key;
  return { useTranslations: vi.fn(() => translate) };
});

vi.mock('next-intl', () => ({ useTranslations, useLocale: () => 'en' }));
vi.mock('@/hooks/use-user-settings', () => ({
  useUserSettings: () => ({ data: { hour_format: '24h' } }),
}));

function renderPage(source?: 'forwarded_email'): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ShortcutInboxPage source={source} />
    </QueryClientProvider>,
  );
}

async function selectOption(label: string, option: string): Promise<void> {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('Shortcut inbox review page', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('previews a zero-amount Lulo notice without offering transaction creation', async () => {
    const rawText = [
      'From: Lulo alerts <notificaciones@lulobank.com>',
      'Subject: Compra realizada',
      '',
      'Realizaste una compra en Demo Store por $0',
      'Origen tarjeta de crédito •8456',
      'Fecha 25 de septiembre de 2026',
      'Hora 7:17 p.m.',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'lulo-1',
              source: 'lulo-email-backfill',
              external_id: 'synthetic-message-1',
              received_at: '2026-09-26T01:20:00.000Z',
              raw_text: rawText,
              status: 'pending',
              created_at: '2026-09-26T01:21:00.000Z',
            },
          ],
          count: 1,
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Zero-amount card notice')).toBeInTheDocument();
    expect(screen.getByText('No charge inferred from a zero-amount notice.')).toBeInTheDocument();
    expect(screen.getByText('Gmail message time')).toBeInTheDocument();
    expect(screen.getByText('Bank event time')).toBeInTheDocument();
    expect(screen.getByText('Original amount')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('Currency unverified')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create new transaction' }),
    ).not.toBeInTheDocument();
  });

  it('previews a Lulo purchase with source excerpts and keeps it read-only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'lulo-2',
              source: 'lulo-email-backfill',
              external_id: 'synthetic-message-2',
              received_at: '2026-09-26T01:20:00.000Z',
              raw_text: [
                'From: Lulo alerts <notificaciones@lulobank.com>',
                'Subject: Compra realizada',
                '',
                'Realizaste una compra en Example Network por $492,041.3',
                'Origen tarjeta de crédito •8456',
                'Fecha 25 de septiembre de 2026',
                'Hora 7:18 p.m.',
              ].join('\n'),
              status: 'pending',
              created_at: '2026-09-26T01:21:00.000Z',
            },
          ],
          count: 1,
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Possible card purchase')).toBeInTheDocument();
    expect(screen.getByText('$492,041.3')).toBeInTheDocument();
    expect(screen.getByText('Example Network')).toBeInTheDocument();
    expect(screen.getByText('8456')).toBeInTheDocument();
    expect(screen.getByText('Source excerpts')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create new transaction' }),
    ).not.toBeInTheDocument();
  });

  it('shows a forwarded Lulo purchase preview while retaining reviewed creation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'forwarded-1',
              source: 'forwarded_email',
              external_id: 'synthetic-message-3',
              received_at: '2026-09-26T01:20:00.000Z',
              raw_text: [
                'From (unverified): notificaciones@lulobank.com',
                '',
                'Compra realizada',
                '',
                'Realizaste una compra en Demo Store por $121,000',
                'Origen tarjeta de crédito •8456',
                'Fecha 25 de septiembre de 2026',
                'Hora 7:18 p.m.',
              ].join('\n'),
              status: 'pending',
              created_at: '2026-09-26T01:21:00.000Z',
            },
          ],
          count: 1,
        }),
      ),
    );
    renderPage('forwarded_email');
    expect(await screen.findByText('Possible card purchase')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create new transaction' })).toHaveAttribute(
      'data-variant',
      'default',
    );
    expect(screen.queryByRole('link', { name: 'Export JSON' })).not.toBeInTheDocument();
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
    renderPage();
    await waitFor(() => expect(screen.getByText('Synthetic private message')).toBeInTheDocument());
    expect(useTranslations).toHaveBeenCalledWith('shortcutInbox');
    expect(screen.getByRole('button', { name: 'Mark non-transaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveAttribute(
      'data-variant',
      'destructive',
    );
    expect(screen.queryByRole('button', { name: /confirm transaction/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export JSON' })).toHaveAttribute(
      'href',
      '/api/shortcut-inbox/export',
    );
  });

  it('shows a newly forwarded sender separately from the notice text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'forwarded-1',
              source: 'forwarded_email',
              external_id: 'message-1',
              received_at: '2026-10-03T10:00:00Z',
              raw_text:
                'From (unverified): new-alert@bancolombia.example\n\nCompra realizada\n\nCompraste $50.000',
              status: 'pending',
              created_at: '2026-10-03T10:00:00Z',
            },
          ],
          count: 1,
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Unverified sender')).toBeInTheDocument();
    expect(screen.getByText('Forwarded email')).toBeInTheDocument();
    expect(screen.getByText('new-alert@bancolombia.example')).toBeInTheDocument();
    expect(screen.getByText(/Compraste \$50.000/)).toBeInTheDocument();
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
    renderPage();
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
    renderPage();
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

  it('requires explicit confirmation to undo an existing match and return the message to review', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/reverse')) {
        expect(init).toEqual({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision_id: 'decision-1' }),
        });
        return Promise.resolve(Response.json({ reversal_id: 'reversal-1' }));
      }
      const pending = url.includes('status=pending');
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: 'item-1',
              source: 'sms-shortcut',
              external_id: null,
              received_at: '2026-09-29T10:00:00Z',
              raw_text: 'Synthetic private message',
              status: pending ? 'pending' : 'matched',
              created_at: '2026-09-29T10:01:00Z',
              ...(!pending && { match: { decision_id: 'decision-1', transaction_id: 'tx-1' } }),
            },
          ],
          count: 1,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    await selectOption('statusFilter', 'Matched existing transaction');
    expect(await screen.findByText('Linked transaction: tx-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review incorrect match' }));
    expect(
      screen.getByText(
        'The message returns to review, but it cannot be linked to this same transaction again. Choose a different existing transaction or create a reviewed one. The transaction and balance remain unchanged.',
      ),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/reverse')),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Undo match and review again' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/shortcut-inbox/item-1/reverse',
        expect.anything(),
      ),
    );
    expect(
      await screen.findByRole('button', { name: 'Show possible matches' }),
    ).toBeInTheDocument();
  });

  it('requires reviewed fields and a second explicit decision when the database finds a same-value transaction', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/accounts')
        return Promise.resolve(
          Response.json([{ id: 'account-1', name: 'Cash', is_active: true, deleted_at: null }]),
        );
      if (url === '/api/categories')
        return Promise.resolve(
          Response.json([{ id: 'category-1', name: 'Food', type: 'expense', is_active: true }]),
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
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create new transaction' }));
    expect(
      fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/create')),
    ).toBe(false);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save reviewed transaction' })).toBeEnabled(),
    );
    await selectOption('Account', 'Cash');
    await selectOption('Category', 'Food');
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

  it('requires explicit time confirmation and sends the original instant for a delayed SMS', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/accounts')
        return Promise.resolve(
          Response.json([{ id: 'account-1', name: 'Savings', is_active: true, deleted_at: null }]),
        );
      if (url === '/api/categories')
        return Promise.resolve(
          Response.json([{ id: 'category-1', name: 'Food', type: 'expense', is_active: true }]),
        );
      if (url.endsWith('/create'))
        return Promise.resolve(
          Response.json({ status: 'created', replayed: false }, { status: 201 }),
        );
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: 'item-1',
              source: 'sms-shortcut',
              external_id: 'receipt-1',
              received_at: '2026-09-28T19:49:00Z',
              raw_text: 'Purchase at 14:29',
              status: 'pending',
              created_at: '2026-09-28T19:50:00Z',
            },
          ],
          count: 1,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create new transaction' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save reviewed transaction' })).toBeEnabled(),
    );
    await selectOption('Account', 'Savings');
    await selectOption('Category', 'Food');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200.50' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Reviewed meal' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Hours' }), { target: { value: '14' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Hours' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Minutes' }), { target: { value: '29' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed transaction' }));
    expect(
      fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/create')),
    ).toBe(false);
    fireEvent.click(screen.getByLabelText('I confirmed this original time'));
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewed transaction' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => typeof url === 'string' && url.endsWith('/create')),
      ).toBe(true),
    );
    const createCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.endsWith('/create'),
    );
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      date: '2026-09-28',
      event_at: '2026-09-28T14:29:00-05:00',
      event_time_confirmed: true,
    });
  });

  it('shows a bounded candidate overflow and does not offer creation', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/accounts')
        return Promise.resolve(
          Response.json([{ id: 'account-1', name: 'Cash', is_active: true, deleted_at: null }]),
        );
      if (url === '/api/categories')
        return Promise.resolve(
          Response.json([{ id: 'category-1', name: 'Food', type: 'expense', is_active: true }]),
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
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create new transaction' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save reviewed transaction' })).toBeEnabled(),
    );
    await selectOption('Account', 'Cash');
    await selectOption('Category', 'Food');
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
