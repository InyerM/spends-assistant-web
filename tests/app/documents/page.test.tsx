import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DocumentsPage from '@/app/(dashboard)/documents/page';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('document inbox', () => {
  afterEach(() => vi.unstubAllGlobals());

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
    expect(screen.getByText('pendingReview')).toBeInTheDocument();
    expect(screen.queryByText(/create transaction/i)).not.toBeInTheDocument();
  });
});
