import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShortcutCreateForm } from '@/components/transactions/shortcut-create-form';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

const receivedAt = '2026-09-26T01:20:00.000Z';
const rawText = [
  'From (unverified): notificaciones@lulobank.com',
  '',
  'Compra realizada',
  '',
  'Realizaste una compra en Demo Store por $121,000',
  'Origen tarjeta de crédito •8456',
  'Fecha 25 de septiembre de 2026',
  'Hora 7:18 p.m.',
].join('\n');
const preview = previewLuloNotice('forwarded_email', rawText, receivedAt);

describe('ShortcutCreateForm', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('prefills parsed evidence and historical proposals in shared controls without posting', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/accounts')
        return Promise.resolve(
          Response.json([
            {
              id: 'card-1',
              name: 'Lulo card',
              institution: 'Lulo Bank',
              type: 'credit_card',
              last_four: '8456',
              currency: 'COP',
              is_active: true,
              deleted_at: null,
            },
          ]),
        );
      if (url === '/api/categories')
        return Promise.resolve(
          Response.json([{ id: 'food', name: 'Food', type: 'expense', is_active: true }]),
        );
      if (url.startsWith('/api/transactions?'))
        return Promise.resolve(
          Response.json({
            data: [
              { description: 'Demo Store', type: 'expense', category_id: 'food' },
              { description: 'Demo Store #123', type: 'expense', category_id: 'food' },
            ],
            count: 2,
          }),
        );
      if (url === '/api/settings/user-settings')
        return Promise.resolve(Response.json({ hour_format: '24h' }));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm
          rawText={rawText}
          inboxId='item-1'
          receivedAt={receivedAt}
          preview={preview}
          analysis={{
            status: 'parsed',
            account_id: 'card-1',
            category_id: 'food',
            category_source: 'ai',
            suggested_type: 'expense',
            description: 'Purchase at Demo Store',
            notes: 'Lulo credit card ending in 8456.',
          }}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('textbox', { name: 'createAmount' })).toHaveValue('121000.00');
    expect(screen.getByRole('textbox', { name: 'createDescription' })).toHaveValue(
      'Purchase at Demo Store',
    );
    expect(screen.getByRole('textbox', { name: 'createNotes' })).toHaveValue(
      'Lulo credit card ending in 8456.',
    );
    expect(screen.getByRole('button', { name: 'createDate' })).toHaveTextContent('Sep 25, 2026');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Hours' })).toHaveValue('19'));
    expect(screen.getByRole('textbox', { name: 'Minutes' })).toHaveValue('18');
    expect(screen.getByRole('checkbox', { name: 'confirmEventTime' })).not.toBeChecked();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'createAccount' })).toHaveTextContent(
        'Lulo card',
      ),
    );
    expect(
      screen.getByRole('combobox', { name: 'createAccount' }).textContent.match(/Lulo card/g),
    ).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'createCategory' })).toHaveTextContent('Food'),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/create'))).toBe(false);
  });

  it('suggests broad shopping for a first-time marketplace purchase without creating it', async () => {
    const amazonText = rawText.replace('Demo Store', 'AMAZON.COM');
    const amazonPreview = previewLuloNotice('forwarded_email', amazonText, receivedAt);
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/accounts') return Promise.resolve(Response.json([]));
      if (url === '/api/categories')
        return Promise.resolve(
          Response.json([
            {
              id: 'shopping-id',
              slug: 'shopping',
              name: 'Shopping',
              type: 'expense',
              is_active: true,
            },
          ]),
        );
      if (url.startsWith('/api/transactions?'))
        return Promise.resolve(Response.json({ data: [], count: 0 }));
      if (url === '/api/merchant-suggestions')
        return Promise.resolve(Response.json({ category_id: 'shopping-id', source: 'catalog' }));
      if (url === '/api/settings/user-settings')
        return Promise.resolve(Response.json({ hour_format: '24h' }));
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm
          rawText={amazonText}
          inboxId='item-amazon'
          receivedAt={receivedAt}
          preview={amazonPreview}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'createCategory' })).toHaveTextContent(
        'Shopping',
      ),
    );
    expect(
      screen.getByRole('combobox', { name: 'createAccount' }).textContent.match(/chooseAccount/g),
    ).toHaveLength(1);
    expect(screen.getByText('merchantCatalogSuggestion')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/merchant-suggestions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ merchant: 'AMAZON.COM' }),
      }),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/create'))).toBe(false);
  });

  it('prefills an owner-validated account from an alias rule even when local inference has no alias', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/accounts')
          return Promise.resolve(
            Response.json([
              {
                id: 'savings',
                name: 'Bancolombia',
                institution: 'bancolombia',
                type: 'savings',
                last_four: '7799',
                bank_account_last_four: '2651',
                currency: 'COP',
                is_active: true,
                deleted_at: null,
              },
            ]),
          );
        if (url === '/api/categories') return Promise.resolve(Response.json([]));
        if (url === '/api/settings/user-settings')
          return Promise.resolve(Response.json({ hour_format: '24h' }));
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm
          rawText={
            'From (unverified): alerts@ayn.notificacionesbancolombia.com\n\nCompraste $15.000 en CODA.CO con tu T.Deb **9989'
          }
          inboxId='item-alias'
          receivedAt={receivedAt}
          analysis={{
            status: 'needs_review',
            account_id: 'savings',
            category_id: null,
            category_source: null,
            suggested_type: 'expense',
            description: 'Compra en CODA.CO',
            notes: null,
          }}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'createAccount' })).toHaveTextContent(
        'Bancolombia',
      ),
    );
  });
});
