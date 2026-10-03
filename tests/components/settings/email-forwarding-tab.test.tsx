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
    expect(screen.getByRole('link', { name: 'reviewInbox' })).toHaveAttribute(
      'href',
      '/transactions/shortcut-inbox',
    );
    expect(screen.getByRole('link', { name: 'gmailInstructions' })).toHaveAttribute(
      'href',
      'https://support.google.com/mail/answer/10957?hl=es-419',
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/email-forwarding', { method: 'POST' });
  });

  it('does not offer address creation before inbound routing is ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'unavailable' })));
    renderTab();

    expect(await screen.findByText('setupUnavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'createAddress' })).not.toBeInTheDocument();
  });

  it('shows a received confirmation as pending Gmail verification', async () => {
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
    expect(screen.getByText('verifyInGmail')).toBeInTheDocument();
    expect(screen.getByText('filterLocked')).toBeInTheDocument();
    expect(screen.getByText('Gmail confirmation code 123456')).not.toBeVisible();
    await waitFor(() => expect(screen.queryByText('awaitingConfirmation')).not.toBeInTheDocument());
  });

  it('records the user confirmation and then gives exact Gmail filter steps', async () => {
    const route = {
      status: 'active',
      address: 'private@example.com',
      created_at: '2026-10-01T00:00:00Z',
      confirmation_received_at: '2026-10-03T16:45:00Z',
      verification_text: 'Confirm: https://mail-settings.google.com/mail/vf-example',
      user_confirmed_at: null,
    };
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve(
          Response.json(
            options?.method === 'PATCH'
              ? { ...route, user_confirmed_at: '2026-10-03T17:00:00Z' }
              : route,
          ),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: 'markVerified' }));

    expect(await screen.findByText('verifiedByUser')).toBeInTheDocument();
    expect(screen.getByText('filterStepOpenOptions')).toBeInTheDocument();
    expect(screen.getByText('filterStepChooseForwarding')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/email-forwarding', { method: 'PATCH' });
  });

  it('offers the recovered Gmail verification link without linking arbitrary URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          status: 'active',
          address: 'private@example.com',
          created_at: '2026-10-01T00:00:00Z',
          confirmation_received_at: '2026-10-03T16:45:00Z',
          verification_text:
            'Confirm: https://mail-settings.google.com/mail/vf-example\nIgnore: https://example.com/steal',
        }),
      ),
    );
    renderTab();

    expect(await screen.findByRole('link', { name: 'openVerification' })).toHaveAttribute(
      'href',
      'https://mail-settings.google.com/mail/vf-example',
    );
    expect(screen.queryByRole('link', { name: /steal/i })).not.toBeInTheDocument();
  });

  it('prepares a broad bank keyword filter that can catch new senders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            url === '/api/accounts'
              ? [
                  {
                    id: 'account-1',
                    name: 'Lulo credit card',
                    institution: 'Lulobank',
                    is_active: true,
                  },
                ]
              : {
                  status: 'active',
                  address: 'private@example.com',
                  created_at: '2026-10-01T00:00:00Z',
                  confirmation_received_at: '2026-10-03T16:45:00Z',
                  verification_text: null,
                  user_confirmed_at: '2026-10-03T17:00:00Z',
                },
          ),
        ),
      ),
    );
    renderTab();

    const keywords = await screen.findByRole('textbox', { name: 'senderGuideKeywords' });
    expect(keywords).toBeVisible();
    expect(keywords).toHaveValue('bancolombia');
    fireEvent.click(screen.getByText('senderGuideCatalogTitle'));
    expect(await screen.findByText('Lulo Bank')).toBeInTheDocument();
    expect(screen.getByText('senderGuideAccountMatch')).toBeInTheDocument();
    expect(screen.getByText('Banco Falabella')).toBeInTheDocument();

    fireEvent.change(keywords, { target: { value: '@lulobank.com' } });
    expect(screen.getByRole('button', { name: 'senderGuideCopyQuery' })).toBeDisabled();
    fireEvent.change(keywords, {
      target: { value: 'bancolombia\nlulobank' },
    });
    expect(screen.getByText('{bancolombia lulobank}')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'senderGuideCopyQuery' })).toBeEnabled();
    expect(screen.getByText('senderGuidePasteInSearch')).toBeInTheDocument();
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
