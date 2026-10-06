import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShortcutCreateForm } from '@/components/transactions/shortcut-create-form';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

const receivedAt = '2026-09-26T01:20:00.000Z';
const preview = previewLuloNotice(
  'forwarded_email',
  [
    'From (unverified): notificaciones@lulobank.com',
    '',
    'Compra realizada',
    '',
    'Realizaste una compra en Demo Store por $121,000',
    'Origen tarjeta de crédito •8456',
    'Fecha 25 de septiembre de 2026',
    'Hora 7:18 p.m.',
  ].join('\n'),
  receivedAt,
);

describe('ShortcutCreateForm', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
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
          inboxId='item-1'
          receivedAt={receivedAt}
          preview={preview}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('textbox', { name: 'createAmount' })).toHaveValue('121000.00');
    expect(screen.getByRole('textbox', { name: 'createDescription' })).toHaveValue('Demo Store');
    expect(screen.getByRole('button', { name: 'createDate' })).toHaveTextContent('Sep 25, 2026');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Hours' })).toHaveValue('19'));
    expect(screen.getByRole('textbox', { name: 'Minutes' })).toHaveValue('18');
    expect(screen.getByRole('checkbox', { name: 'confirmEventTime' })).not.toBeChecked();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'createAccount' })).toHaveTextContent(
        'Lulo card',
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'createCategory' })).toHaveTextContent('Food'),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/create'))).toBe(false);
  });
});
