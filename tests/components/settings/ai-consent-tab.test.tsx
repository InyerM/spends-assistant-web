import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiConsentTab } from '@/components/settings/ai-consent-tab';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const state = {
  version: 'external-ai-v1',
  consents: { financial_text: false, document_images: false, forwarded_email: false },
};

function renderTab(): void {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AiConsentTab />
    </QueryClientProvider>,
  );
}

describe('AiConsentTab', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('starts every scope off and submits only the scope explicitly enabled', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve(
          Response.json(
            options?.method === 'POST'
              ? { ...state, consents: { ...state.consents, document_images: true } }
              : state,
          ),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderTab();

    const images = await screen.findByRole('switch', { name: 'documentImages' });
    expect(images).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'financialText' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: 'forwardedEmail' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByText('providerDisclosure')).toBeInTheDocument();
    fireEvent.click(images);
    await waitFor(() => expect(images).toHaveAttribute('aria-checked', 'true'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/consent',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          scope: 'document_images',
          granted: true,
          version: 'external-ai-v1',
        }),
      }),
    );
  });

  it('does not show granted controls when consent cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Unavailable' }, { status: 503 })),
    );
    renderTab();
    expect(await screen.findByRole('alert')).toHaveTextContent('loadError');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
