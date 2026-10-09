import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('shows the AI time fallback while preserving a manual time edit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/accounts' || url === '/api/categories')
          return Promise.resolve(Response.json([]));
        if (url === '/api/settings/user-settings')
          return Promise.resolve(Response.json({ hour_format: '24h' }));
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const props = {
      inboxId: 'item-1',
      rawText: 'Pago QR de $15,800 el 02/10/2026 a las 16:31.',
      receivedAt,
      onCreated: vi.fn(),
      onCancel: vi.fn(),
    };
    const analysis = {
      status: 'needs_review' as const,
      account_id: null,
      category_id: null,
      category_source: null,
      suggested_type: 'expense' as const,
      description: null,
      notes: null,
      bank_event_at: '2026-10-02T16:31:00-05:00',
    };
    const view = render(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm {...props} analysis={analysis} />
      </QueryClientProvider>,
    );
    const hours = await screen.findByDisplayValue('16');
    expect(screen.getByDisplayValue('31')).toBeVisible();
    expect(hours.closest('.ai-field')).toHaveAttribute('data-ai-state', 'suggested');
    fireEvent.change(hours, { target: { value: '17' } });
    fireEvent.blur(hours);
    view.rerender(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm
          {...props}
          analysis={{ ...analysis, bank_event_at: '2026-10-02T18:40:00-05:00' }}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByDisplayValue('17')).toBeVisible();
    expect(screen.getByDisplayValue('31')).toBeVisible();
    expect(screen.getByDisplayValue('17').closest('.ai-field')).toBeNull();
  });

  it('shows local evidence while AI runs, then applies suggestions without replacing manual edits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/accounts') return Promise.resolve(Response.json([]));
        if (url === '/api/categories') return Promise.resolve(Response.json([]));
        if (url.startsWith('/api/transactions?'))
          return Promise.resolve(Response.json({ data: [], count: 0 }));
        if (url === '/api/settings/user-settings')
          return Promise.resolve(Response.json({ hour_format: '24h' }));
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const props = {
      rawText,
      inboxId: 'item-1',
      receivedAt,
      preview,
      onCreated: vi.fn(),
      onCancel: vi.fn(),
    };
    const view = render(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm {...props} analyzing />
      </QueryClientProvider>,
    );
    expect(screen.getByDisplayValue('121000.00')).toBeVisible();
    expect(screen.getByText('analysisRunning')).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'createDescription' }).closest('.ai-field'),
    ).toHaveAttribute('data-ai-state', 'analyzing');
    expect(screen.getByRole('button', { name: 'saveReviewed' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'createDescription' }), {
      target: { value: 'My own description' },
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm
          {...props}
          analysis={{
            status: 'parsed',
            account_id: null,
            category_id: null,
            category_source: null,
            suggested_type: 'expense',
            description: 'AI description',
            notes: 'AI notes',
          }}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByDisplayValue('My own description')).toBeVisible();
    expect(screen.getByDisplayValue('AI notes')).toBeVisible();
    expect(screen.queryByText('analysisRunning')).not.toBeInTheDocument();
    expect(screen.getByText('analysisReady')).toBeVisible();
    expect(screen.getByDisplayValue('AI notes').closest('.ai-field')).toHaveAttribute(
      'data-ai-state',
      'suggested',
    );
    expect(screen.getByDisplayValue('My own description').closest('.ai-field')).toBeNull();
    view.rerender(
      <QueryClientProvider client={client}>
        <ShortcutCreateForm
          {...props}
          analysis={{
            status: 'parsed',
            account_id: null,
            category_id: null,
            category_source: null,
            suggested_type: 'expense',
            description: 'Demo Store',
            notes: null,
            ai_status: 'unavailable',
            analysis_source: 'evidence',
          }}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText('analysisUnavailable')).toBeVisible();
    expect(screen.queryByText('analysisReady')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('121000.00')).toBeVisible();
    expect(screen.getByDisplayValue('My own description')).toBeVisible();
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
  it('prefills an owned card repayment as a transfer with amount and original bank time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/accounts')
          return Promise.resolve(
            Response.json([
              {
                id: 'savings',
                name: 'Bancolombia savings',
                institution: 'Bancolombia',
                type: 'savings',
                currency: 'COP',
                last_four: '5678',
                is_active: true,
                deleted_at: null,
              },
              {
                id: 'card',
                name: 'Bancolombia credit',
                institution: 'Bancolombia',
                type: 'credit_card',
                currency: 'COP',
                last_four: '1234',
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
            'From (unverified): alertasynotificaciones@bancolombia.com.co\nBancolombia: Pagaste $123,456 en la tarjeta de credito *1234 desde la cuenta *5678, el 01/10/2026 18:37.'
          }
          receivedAt={receivedAt}
          inboxId='payment'
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'createAccount' })).toHaveTextContent(
        'Bancolombia savings',
      ),
    );
    expect(screen.getByRole('combobox', { name: 'transferTo' })).toHaveTextContent(
      'Bancolombia credit',
    );
    expect(screen.getByRole('textbox', { name: 'createAmount' })).toHaveValue('123456.00');
    expect(screen.getByRole('textbox', { name: 'Hours' })).toHaveValue('18');
    expect(screen.getByRole('textbox', { name: 'Minutes' })).toHaveValue('37');
    expect(screen.queryByRole('combobox', { name: 'createCategory' })).not.toBeInTheDocument();
  });
});
