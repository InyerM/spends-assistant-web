import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmailForwardingTab } from '@/components/settings/email-forwarding-tab';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}));

function renderTab(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EmailForwardingTab />
    </QueryClientProvider>,
  );
}

describe('EmailForwardingTab', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('creates a private address before showing Gmail setup steps', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, options?: RequestInit) =>
      Promise.resolve(
        Response.json(
          options?.method === 'POST'
            ? {
                status: 'active',
                address: 'private@example.com',
                created_at: '2026-10-01T00:00:00Z',
                confirmation_received_at: null,
                verification_text: null,
              }
            : { status: 'unconfigured' },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: 'createAddress' }));

    expect(await screen.findByText('private@example.com')).toBeInTheDocument();
    expect(screen.getByText('addAddressTitle')).toBeInTheDocument();
    expect(screen.getByText('createFilterTitle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'gmailInstructions' })).toHaveAttribute(
      'href',
      'https://support.google.com/mail/answer/10957?hl=es-419',
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/email-forwarding', { method: 'POST' });
  });

  it('shows received verification text without claiming Gmail forwarding is active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          status: 'active',
          address: 'private@example.com',
          created_at: '2026-10-01T00:00:00Z',
          confirmation_received_at: '2026-10-01T12:00:00Z',
          verification_text: 'Gmail confirmation code 123456',
        }),
      ),
    );
    renderTab();

    expect(await screen.findByText('Gmail confirmation code 123456')).toBeInTheDocument();
    expect(screen.getByText('confirmationReceived')).toBeInTheDocument();
    expect(screen.getByText('createFilterTitle')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('awaitingConfirmation')).not.toBeInTheDocument());
  });

  it('keeps the removal confirmation open when the server rejects deletion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve(
          options?.method === 'DELETE'
            ? Response.json({ error: 'Unavailable' }, { status: 503 })
            : Response.json({
                status: 'active',
                address: 'private@example.com',
                created_at: '2026-10-01T00:00:00Z',
                confirmation_received_at: null,
                verification_text: null,
              }),
        ),
      ),
    );
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: 'removeAddress' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'removeAddress' }).at(-1)!);

    expect(await screen.findByRole('alert')).toHaveTextContent('removeError');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});
