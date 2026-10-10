import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionOrigin } from '@/components/transactions/transaction-origin';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('transaction origin', () => {
  it('links the original document and expands the received email using the shared evidence view', async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) =>
      url.startsWith('/api/statements/proofs')
        ? Response.json({ data: [] })
        : Response.json({
            document: { id: 'doc', file_name: 'Synthetic receipt.pdf' },
            inbox: {
              id: 'mail',
              source: 'forwarded_email',
              raw_text:
                'From (unverified): notices@bank.example\n\nSynthetic original subject\n\nSynthetic original body',
              received_at: '2026-10-08T12:00:00Z',
            },
          }),
    );
    vi.stubGlobal('fetch', fetch);
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TransactionOrigin transactionId='tx' />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('link', { name: /Synthetic receipt.pdf/ })).toHaveAttribute(
      'href',
      '/documents#document-doc',
    );
    expect(screen.queryByText('Synthetic original subject')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'viewOriginalEmail' }));
    expect(screen.getByText('Synthetic original subject')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/transactions/tx/origin');
  });
});
