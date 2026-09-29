import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentsPage from '@/app/(dashboard)/documents/page';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('document inbox', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows extracted observations as pending review without a create transaction action', async () => {
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
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByText('Coffee')).toBeInTheDocument());
    expect(screen.getByText('observations')).toBeInTheDocument();
    expect(screen.getByText(/observationStatus.pending/)).toBeInTheDocument();
    expect(screen.queryByText(/create transaction/i)).not.toBeInTheDocument();
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
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByText('receipt.png')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'extract' })).toBeInTheDocument();
  });

  it('labels transaction suggestions as candidates and offers no confirmation action', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.endsWith('/suggestions')
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
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByText('Coffee')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'findSuggestions' }));
    await waitFor(() => expect(screen.getByText('Coffee shop')).toBeInTheDocument());
    expect(screen.getByText('candidateOnly')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /confirm|accept|reject/i }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/documents/doc-1/suggestions');
    expect(fetchMock.mock.calls.every(([, options]) => options?.method === undefined)).toBe(true);
  });
});
