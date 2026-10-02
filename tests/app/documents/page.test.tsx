import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      { id: 'account-2', name: 'Nequi', currency: 'COP', is_active: true, deleted_at: null },
    ],
  }),
}));
vi.mock('@/lib/api/queries/category.queries', () => ({
  useCategories: () => ({ data: [] }),
}));

function renderDocuments(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DocumentsPage />
    </QueryClientProvider>,
  );
}

function chooseSelect(label: string, option: string): void {
  fireEvent.click(screen.getByRole('combobox', { name: label }));
  fireEvent.click(screen.getByRole('option', { name: new RegExp(option) }));
}

describe('document inbox', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('offers reviewed transaction creation from a pending observation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'doc-1',
              file_name: 'receipt.png',
              status: 'extracted',
              document_type: 'receipt',
              created_at: '2026-09-28T12:00:00Z',
              document_observations: [
                {
                  id: 'obs-1',
                  ordinal: 0,
                  amount: 1000,
                  currency: 'COP',
                  occurred_at_text: '2026-09-28',
                  description: 'Coffee',
                  counterparty: 'Cafe',
                  reference: null,
                  source_excerpt: 'Coffee 1000',
                  confidence: 0.8,
                  status: 'pending',
                },
              ],
            },
          ],
        }),
      ),
    );
    renderDocuments();
    await waitFor(() => expect(screen.getAllByText('Coffee')[0]).toBeInTheDocument());
    expect(screen.getByText('observations')).toBeInTheDocument();
    expect(screen.getByText(/observationStatus.pending/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'createTransaction' })).toBeInTheDocument();
  });

  it('creates and links a signed bank debit only after the user reviews its fields', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/transactions' && options?.method === 'POST') {
        return Promise.resolve(Response.json({ id: 'tx-created' }, { status: 201 }));
      }
      if (url === '/api/documents/doc-1/decisions') {
        return Promise.resolve(Response.json({ decision_id: 'decision-1' }));
      }
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: 'doc-1',
              file_name: 'bank.png',
              status: 'extracted',
              document_type: 'bank_screenshot',
              created_at: '2026-09-28T12:00:00Z',
              document_observations: [
                {
                  id: 'obs-1',
                  ordinal: 0,
                  amount: -12000,
                  currency: 'COP',
                  occurred_at_text: '2026-09-28',
                  description: 'Cafe North',
                  counterparty: 'Cafe North',
                  reference: null,
                  source_excerpt: 'Bank debit 12,000',
                  confidence: 0.9,
                  status: 'pending',
                },
              ],
            },
          ],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDocuments();
    await screen.findAllByText('Cafe North');
    fireEvent.click(screen.getByRole('button', { name: 'createTransaction' }));
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
    fireEvent.change(screen.getByLabelText('transactionTime'), { target: { value: '13:25' } });
    chooseSelect('transactionAccount', 'Bancolombia');
    fireEvent.click(screen.getByLabelText('createChecked'));
    fireEvent.click(screen.getByRole('button', { name: 'confirmCreate' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/documents/doc-1/decisions',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const payload = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url === '/api/transactions')?.[1]?.body as string,
    );
    expect(payload).toMatchObject({
      amount: 12000,
      type: 'expense',
      date: '2026-09-28',
      account_id: 'account-1',
      source: 'web-document',
      parsed_data: {
        document_id: 'doc-1',
        observation_id: 'obs-1',
      },
    });
  });

  it('requires a distinct destination account for a reviewed transfer', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/transactions' && options?.method === 'POST')
        return Promise.resolve(Response.json({ id: 'tx-created' }, { status: 201 }));
      if (url.endsWith('/decisions'))
        return Promise.resolve(Response.json({ decision_id: 'decision-1' }));
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: 'doc-1',
              file_name: 'bank.png',
              status: 'extracted',
              document_type: 'bank_screenshot',
              created_at: '2026-09-28T12:00:00Z',
              document_observations: [
                {
                  id: 'obs-1',
                  ordinal: 0,
                  amount: -12000,
                  currency: 'COP',
                  occurred_at_text: '2026-09-28',
                  description: 'Own account transfer',
                  counterparty: null,
                  reference: null,
                  source_excerpt: 'Transfer 12000',
                  confidence: 0.9,
                  status: 'pending',
                },
              ],
            },
          ],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDocuments();
    await screen.findAllByText('Own account transfer');
    fireEvent.click(screen.getByRole('button', { name: 'createTransaction' }));
    fireEvent.change(screen.getByLabelText('transactionTime'), { target: { value: '13:25' } });
    chooseSelect('transactionType', 'transfer');
    chooseSelect('transactionAccount', 'Bancolombia');
    fireEvent.click(screen.getByLabelText('createChecked'));
    fireEvent.click(screen.getByRole('button', { name: 'confirmCreate' }));
    expect(
      fetchMock.mock.calls.filter(
        ([url, options]) => url === '/api/transactions' && options?.method === 'POST',
      ),
    ).toHaveLength(0);
    chooseSelect('destinationAccount', 'Nequi');
    fireEvent.click(screen.getByLabelText('createChecked'));
    fireEvent.click(screen.getByRole('button', { name: 'confirmCreate' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === '/api/transactions' && options?.method === 'POST',
        ),
      ).toBe(true),
    );
    const payload = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url === '/api/transactions')?.[1]?.body as string,
    );
    expect(payload).toMatchObject({
      type: 'transfer',
      account_id: 'account-1',
      transfer_to_account_id: 'account-2',
    });
  });

  it('offers retry when a processing claim is stale', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'doc-stale',
              file_name: 'receipt.png',
              status: 'processing',
              document_type: null,
              created_at: '2026-09-28T12:00:00Z',
              updated_at: '2000-01-01T00:00:00Z',
              document_observations: [],
            },
          ],
        }),
      ),
    );
    renderDocuments();
    await waitFor(() => expect(screen.getByText('receipt.png')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'extract' })).toBeInTheDocument();
  });

  it('requires a second explicit action before confirming a candidate', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.endsWith('/decisions')
            ? { decision_id: 'decision-1' }
            : url.endsWith('/suggestions')
              ? {
                  data: [
                    {
                      observation_id: 'obs-1',
                      status: 'pending',
                      total_candidates: 1,
                      search_limited: false,
                      candidates: [
                        {
                          kind: 'candidate',
                          transaction_id: 'tx-1',
                          amount: 1000,
                          amount_difference: 0,
                          date: '2026-09-28',
                          description: 'Coffee shop',
                          account_id: 'account-1',
                          account_name: 'Checking',
                          type: 'expense',
                          basis: 'exact_date',
                          days_apart: 0,
                          reference_hint: false,
                          description_hint: true,
                        },
                      ],
                    },
                  ],
                }
              : {
                  data: [
                    {
                      id: 'doc-1',
                      file_name: 'receipt.png',
                      status: 'extracted',
                      document_type: 'receipt',
                      created_at: '2026-09-28T12:00:00Z',
                      document_observations: [
                        {
                          id: 'obs-1',
                          ordinal: 0,
                          amount: 1000,
                          currency: 'COP',
                          occurred_at_text: '2026-09-28',
                          description: 'Coffee',
                          counterparty: null,
                          reference: null,
                          source_excerpt: 'Coffee 1000',
                          confidence: 0.8,
                          status: 'pending',
                        },
                      ],
                    },
                  ],
                },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderDocuments();
    await waitFor(() => expect(screen.getAllByText('Coffee')[0]).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'findSuggestions' }));
    await waitFor(() => expect(screen.getByText('Coffee shop')).toBeInTheDocument());
    expect(screen.getByText('candidateOnly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'reviewMatch' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === undefined)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'reviewMatch' }));
    expect(screen.getByText('confirmMatchSummary')).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === undefined)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'confirmMatch' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/documents/doc-1/decisions',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/documents/doc-1/suggestions');
    const body = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url.endsWith('/decisions'))?.[1]?.body as string,
    );
    expect(body).toMatchObject({
      observation_id: 'obs-1',
      action: 'accept',
      transaction_id: 'tx-1',
    });
    expect(body.idempotency_key).toEqual(expect.any(String));
  });
});
