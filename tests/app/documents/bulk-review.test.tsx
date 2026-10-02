import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DocumentsPage from '@/app/(dashboard)/documents/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}));
vi.mock('@/lib/api/queries/account.queries', () => ({
  useAccounts: () => ({
    data: [
      { id: 'account-1', name: 'Bancolombia', currency: 'COP', is_active: true, deleted_at: null },
    ],
  }),
}));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useCategories: () => ({
    data: [{ id: 'category-groceries', name: 'Supermercado', type: 'expense', is_active: true }],
  }),
}));

const observations = [
  {
    id: 'obs-1',
    ordinal: 0,
    amount: -12000,
    currency: 'USD',
    occurred_at_text: '2026-09-28',
    description: 'Lunch',
    counterparty: 'Lunch',
    source_excerpt: 'Bancolombia compra $12.000',
    confidence: 0.9,
    status: 'pending',
  },
  {
    id: 'obs-2',
    ordinal: 1,
    amount: -6000,
    currency: 'USD',
    occurred_at_text: '2026-09-28',
    description: 'Parking',
    counterparty: 'Parking',
    source_excerpt: 'Bancolombia compra $6.000',
    confidence: 0.9,
    status: 'pending',
  },
  {
    id: 'obs-3',
    ordinal: 2,
    amount: -3000,
    currency: 'COP',
    occurred_at_text: '2026-09-28',
    description: 'Old rejection',
    counterparty: null,
    source_excerpt: 'Bancolombia compra $3.000',
    confidence: 0.9,
    status: 'rejected',
  },
];

function mockRequests(
  recoveredId: string | null = null,
  failFirstCreate = false,
  candidate = false,
  positiveReceipt = false,
  duplicateOnCreate = false,
): ReturnType<typeof vi.fn> {
  let rows = observations.map((item) => ({
    ...item,
    amount: positiveReceipt && item.id === 'obs-1' ? 12000 : item.amount,
  }));
  let archived = false;
  let created = 0;
  const mock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/suggestions'))
      return Response.json({
        data: candidate
          ? [
              {
                observation_id: 'obs-1',
                status: 'pending',
                total_candidates: 1,
                search_limited: false,
                candidates: [
                  {
                    kind: 'candidate',
                    transaction_id: 'tx-existing',
                    amount: 12000,
                    amount_difference: 0,
                    date: '2026-09-28',
                    description: 'Lunch',
                    account_name: 'Bancolombia',
                    basis: 'exact_date',
                    reference_hint: false,
                    description_hint: true,
                  },
                ],
              },
            ]
          : [],
      });
    if (url === '/api/transactions/parse' && options?.method === 'POST')
      return Response.json({
        parsed: { category: 'groceries', confidence: 91 },
        resolved: { category_id: 'category-groceries', account_id: 'wrong-account' },
        applied_rules: [],
      });
    if (url === '/api/documents/doc-1' && options?.method === 'PATCH') {
      archived = JSON.parse(options.body as string).archived as boolean;
      return Response.json({ archived });
    }
    if (url.endsWith('/restore') && options?.method === 'POST') {
      rows = rows.map((item) => (item.id === 'obs-3' ? { ...item, status: 'pending' } : item));
      return Response.json({ restoration_id: 'restore-1' });
    }
    if (url === '/api/documents' && !options?.method)
      return Response.json({
        data: [
          {
            id: 'doc-1',
            file_name: 'bank.png',
            status: 'extracted',
            archived_at: archived ? '2026-10-01T00:00:00Z' : null,
            document_type: positiveReceipt ? 'receipt' : 'bank_screenshot',
            created_at: '2026-09-28T12:00:00Z',
            updated_at: '2026-09-28T12:00:00Z',
            document_observations: rows,
          },
        ],
      });
    if (url.includes('/observations/') && options?.method === 'PATCH')
      return Response.json(JSON.parse(options.body as string));
    if (url.includes('/observations/') && !options?.method)
      return Response.json({ transaction_id: recoveredId });
    if (url === '/api/transactions' && options?.method === 'POST') {
      created += 1;
      if (duplicateOnCreate)
        return Response.json(
          {
            duplicate: true,
            match: { id: 'tx-existing', description: 'Lunch', date: '2026-09-28', amount: 12000 },
          },
          { status: 409 },
        );
      if (failFirstCreate && created === 1)
        return Response.json({ error: 'Temporary failure' }, { status: 503 });
      return Response.json({ id: `tx-${created}` }, { status: 201 });
    }
    if (url.endsWith('/decisions') && options?.method === 'POST') {
      const decision = JSON.parse(options.body as string);
      rows = rows.map((item) =>
        item.id === decision.observation_id
          ? { ...item, status: decision.action === 'accept' ? 'confirmed' : 'rejected' }
          : item,
      );
      return Response.json({ decision_id: 'decision-1' });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

function chooseBulkAccount(): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'bulkAccount' }));
  fireEvent.click(screen.getByRole('option', { name: /Bancolombia/ }));
}

function renderDocuments(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DocumentsPage />
    </QueryClientProvider>,
  );
}

describe('document batch review', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps extracted data collapsed and separates rejected rows', async () => {
    mockRequests();
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    expect(screen.getByText(/^rejectedObservations/)).toBeInTheDocument();
    expect(screen.queryByText('Old rejection')).not.toBeVisible();
    fireEvent.click(screen.getByText(/^rejectedObservations/));
    expect(screen.getByText('Old rejection')).toBeVisible();
  });

  it('shows each pending movement once and opens its shared edit controls from the row', async () => {
    mockRequests();
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    expect(screen.getAllByText('Lunch')).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'editObservation' })[0]);
    expect(screen.getByRole('textbox', { name: 'Hours' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'transactionCategory' })).toBeInTheDocument();
  });

  it('asks for a rejection reason in a dialog and saves free text for Other', async () => {
    const fetchMock = mockRequests();
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'reviewReject' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'rejectReason' });
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'rejectReason' }));
    fireEvent.click(screen.getByRole('option', { name: 'reason.other' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'otherReasonDetail' }), {
      target: { value: 'This is a balance alert, not a purchase' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'confirmReject' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(1),
    );
    expect(
      JSON.parse(
        fetchMock.mock.calls.find(([url]) => url.endsWith('/decisions'))![1]!.body as string,
      ),
    ).toMatchObject({
      reason: 'other',
      reason_detail: 'This is a balance alert, not a purchase',
    });
  });

  it('reviews two ambiguous dollar rows as COP and approves them into transactions', async () => {
    const fetchMock = mockRequests();
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getByRole('button', { name: 'selectAllPending' }));
    expect(screen.getByText('selectedCount')).toBeInTheDocument();
    chooseBulkAccount();
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([url, opts]) => url === '/api/transactions' && opts?.method === 'POST',
        ),
      ).toHaveLength(2),
    );
    expect(
      fetchMock.mock.calls.filter(
        ([url, opts]) => url.includes('/observations/') && opts?.method === 'PATCH',
      ),
    ).toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(
        ([url, opts]) => url.endsWith('/decisions') && opts?.method === 'POST',
      ),
    ).toHaveLength(2);
    const createdPayload = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url === '/api/transactions')![1]!.body as string,
    );
    expect(createdPayload).toMatchObject({
      account_id: 'account-1',
      amount: 12000,
      source: 'web-document',
      parsed_data: { document_id: 'doc-1', observation_id: 'obs-1', time_source: 'unknown' },
    });
  });

  it('records a positive OCR receipt total as an expense after review', async () => {
    const fetchMock = mockRequests(null, false, false, true);
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'selectObservation' })[0]);
    chooseBulkAccount();
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === '/api/transactions')).toHaveLength(1),
    );
    const createdPayload = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url === '/api/transactions')![1]!.body as string,
    );
    expect(createdPayload.type).toBe('expense');
  });

  it('requires explicit confirmation before rejecting selected observations', async () => {
    const fetchMock = mockRequests();
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getByRole('button', { name: 'selectAllPending' }));
    fireEvent.click(screen.getByRole('button', { name: 'rejectSelected' }));
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(0);
    const review = screen.getByRole('dialog', { name: 'rejectReason' });
    fireEvent.click(within(review).getByRole('combobox', { name: 'rejectReason' }));
    fireEvent.click(screen.getByRole('option', { name: 'reason.duplicate_capture' }));
    fireEvent.click(within(review).getByRole('button', { name: 'confirmReject' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(2),
    );
    expect(
      JSON.parse(
        fetchMock.mock.calls.find(([url]) => url.endsWith('/decisions'))![1]!.body as string,
      ),
    ).toMatchObject({ reason: 'duplicate_capture' });
  });

  it('shows likely existing transactions before approval', async () => {
    mockRequests(null, false, true);
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    expect(await screen.findByText(/possibleDuplicate/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'reviewExistingTransaction' })).toHaveAttribute(
      'href',
      '/transactions/tx-existing',
    );
  });

  it('links a suggested existing transaction only after a second confirmation in the same row', async () => {
    const fetchMock = mockRequests(null, false, true);
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    const matchButton = await screen.findByRole('button', { name: 'reviewMatch' });
    fireEvent.click(matchButton);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'confirmMatch' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(1),
    );
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/transactions')).toHaveLength(0);
    expect(
      JSON.parse(
        fetchMock.mock.calls.find(([url]) => url.endsWith('/decisions'))![1]!.body as string,
      ),
    ).toMatchObject({ action: 'accept', transaction_id: 'tx-existing' });
  });

  it('can link a duplicate found during creation without creating it again', async () => {
    const fetchMock = mockRequests(null, false, false, false, true);
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'selectObservation' })[0]);
    chooseBulkAccount();
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    const linkButton = await screen.findByRole('button', { name: 'linkDuplicate' });
    fireEvent.click(linkButton);
    fireEvent.click(screen.getByRole('button', { name: 'confirmMatch' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(1),
    );
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/transactions')).toHaveLength(1);
  });

  it('uses an AI category proposal without changing the reviewed amount or account', async () => {
    const fetchMock = mockRequests();
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'selectObservation' })[0]);
    chooseBulkAccount();
    fireEvent.click(screen.getByRole('button', { name: 'suggestCategoryWithAi' }));
    expect(await screen.findByText(/aiCategoryHint/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/transactions')).toHaveLength(0);
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === '/api/transactions')).toHaveLength(1),
    );
    const createdPayload = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url === '/api/transactions')![1]!.body as string,
    );
    expect(createdPayload).toMatchObject({
      amount: 12000,
      account_id: 'account-1',
      category_id: 'category-groceries',
    });
  });

  it('restores a rejected observation and archives a capture reversibly', async () => {
    const fetchMock = mockRequests();
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getByRole('button', { name: 'archiveCapture' }));
    await waitFor(() => expect(screen.queryByText('bank.png')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /archivedCaptures/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'restoreCapture' }));
    await screen.findByText('bank.png');
    fireEvent.click(screen.getByRole('button', { name: 'activeCaptures' }));
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getByText(/^rejectedObservations/));
    fireEvent.click(screen.getByRole('button', { name: 'restoreObservation' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/restore'))).toBe(true),
    );
  });

  it('relinks an existing created transaction without posting another balance change', async () => {
    const fetchMock = mockRequests('tx-already-created');
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'selectObservation' })[0]);
    chooseBulkAccount();
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(1),
    );
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/transactions')).toHaveLength(0);
  });

  it('does not duplicate a saved OCR correction when transaction creation is retried', async () => {
    const fetchMock = mockRequests(null, true);
    renderDocuments();
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'selectObservation' })[0]);
    chooseBulkAccount();
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    await waitFor(() => expect(screen.getByText('Temporary failure')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(1),
    );
    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) => url.includes('/observations/') && options?.method === 'PATCH',
      ),
    ).toHaveLength(1);
  });
});
