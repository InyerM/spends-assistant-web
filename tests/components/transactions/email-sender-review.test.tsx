import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailSenderReview } from '@/components/transactions/email-sender-review';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('requires an explicit confirmation and updates the sender in place without navigation', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      sender_address: 'notice@bank.example',
      bank_name: 'Bancolombia',
      confirmed_at: '2026-10-09T12:00:00Z',
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EmailSenderReview
        inboxId='11111111-1111-4111-8111-111111111111'
        sender='notice@bank.example'
        detectedBank='Bancolombia'
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'verifySender' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'confirmSender' }));
  expect(await screen.findByRole('button', { name: 'changeConfirmedBank' })).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(
    '/api/shortcut-inbox/11111111-1111-4111-8111-111111111111/sender',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ bank_name: 'Bancolombia' }) }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('senderConfirmed')).toHaveClass('text-success');
});
