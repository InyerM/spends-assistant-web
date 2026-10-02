import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DocumentsPage from '@/app/(dashboard)/documents/page';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/api/queries/account.queries', () => ({
  useAccounts: () => ({
    data: [
      { id: 'account-1', name: 'Bancolombia', currency: 'COP', is_active: true, deleted_at: null },
    ],
  }),
}));
vi.mock('@/lib/api/queries/category.queries', () => ({ useCategories: () => ({ data: [] }) }));

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
): ReturnType<typeof vi.fn> {
  let rows = observations.map((item) => ({ ...item }));
  let created = 0;
  const mock = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/documents' && !options?.method)
      return Response.json({
        data: [
          {
            id: 'doc-1',
            file_name: 'bank.png',
            status: 'extracted',
            document_type: 'bank_screenshot',
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

describe('document batch review', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('keeps extracted data collapsed and separates rejected rows', async () => {
    mockRequests();
    render(<DocumentsPage />);
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    expect(screen.getByText(/^rejectedObservations/)).toBeInTheDocument();
    expect(screen.queryByText('Old rejection')).not.toBeVisible();
    fireEvent.click(screen.getByText(/^rejectedObservations/));
    expect(screen.getByText('Old rejection')).toBeVisible();
  });

  it('reviews two ambiguous dollar rows as COP and approves them into transactions', async () => {
    const fetchMock = mockRequests();
    render(<DocumentsPage />);
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getByRole('button', { name: 'selectAllPending' }));
    expect(screen.getByText('selectedCount')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('bulkAccount'), { target: { value: 'account-1' } });
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

  it('requires explicit confirmation before rejecting selected observations', async () => {
    const fetchMock = mockRequests();
    render(<DocumentsPage />);
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getByRole('button', { name: 'selectAllPending' }));
    fireEvent.click(screen.getByRole('button', { name: 'rejectSelected' }));
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(0);
    const review = screen.getByRole('region', { name: 'bulkRejectConfirmation' });
    fireEvent.click(within(review).getByRole('button', { name: 'confirmRejectSelected' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(2),
    );
  });

  it('relinks an existing created transaction without posting another balance change', async () => {
    const fetchMock = mockRequests('tx-already-created');
    render(<DocumentsPage />);
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'selectObservation' })[0]);
    fireEvent.change(screen.getByLabelText('bulkAccount'), { target: { value: 'account-1' } });
    fireEvent.click(screen.getByLabelText('confirmSelected'));
    fireEvent.click(screen.getByRole('button', { name: 'approveSelected' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/decisions'))).toHaveLength(1),
    );
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/transactions')).toHaveLength(0);
  });

  it('does not duplicate a saved OCR correction when transaction creation is retried', async () => {
    const fetchMock = mockRequests(null, true);
    render(<DocumentsPage />);
    await screen.findByText('bank.png');
    fireEvent.click(screen.getAllByText(/^observations/)[0]);
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'selectObservation' })[0]);
    fireEvent.change(screen.getByLabelText('bulkAccount'), { target: { value: 'account-1' } });
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
