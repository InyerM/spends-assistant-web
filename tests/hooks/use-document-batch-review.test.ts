import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDocumentBatchReview, type DocumentReviewRow } from '@/hooks/use-document-batch-review';
import type { Account, Category } from '@/types';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

const rows: DocumentReviewRow[] = [
  {
    id: 'obs-1',
    ordinal: 0,
    amount: -12000,
    currency: 'USD',
    occurred_at_text: '2026-09-28T08:25:00',
    description: 'Lunch',
    counterparty: 'Lunch',
    source_excerpt: 'Bancolombia compra $12.000',
    confidence: 0.9,
    status: 'pending',
    document_type: 'bank_screenshot',
  },
  {
    id: 'obs-2',
    ordinal: 1,
    amount: -6000,
    currency: 'COP',
    occurred_at_text: '2026-09-28',
    description: 'Parking',
    counterparty: 'Parking',
    source_excerpt: 'Bancolombia compra $6.000',
    confidence: 0.9,
    status: 'pending',
    document_type: 'bank_screenshot',
  },
];
const accounts = [
  { id: 'account-1', name: 'Bancolombia', currency: 'COP', is_active: true, deleted_at: null },
] as Account[];

function renderReview(categories: Category[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): React.ReactElement =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(
    () =>
      useDocumentBatchReview({
        documentId: 'doc-1',
        rows,
        history: [],
        accounts,
        categories,
        suggestions: [],
        onRefresh: vi.fn().mockResolvedValue(undefined),
      }),
    { wrapper },
  );
}

describe('useDocumentBatchReview', () => {
  it('initializes selected OCR drafts with suggested currency and extracted time', () => {
    const { result } = renderReview();
    act(() => result.current.toggle(rows[0]));
    expect(result.current.selected).toEqual(['obs-1']);
    expect(result.current.drafts['obs-1']).toMatchObject({
      amount: '12000',
      currency: 'COP',
      date: '2026-09-28',
      time: '08:25',
      type: 'expense',
    });
  });

  it('selects a row for individual editing and applies a shared account to existing drafts', () => {
    const { result } = renderReview();
    act(() => result.current.editRow(rows[0]));
    expect(result.current.expandedRowId).toBe('obs-1');
    expect(result.current.selected).toEqual(['obs-1']);
    act(() => result.current.selectAll());
    act(() => result.current.selectAccount('account-1'));
    expect(result.current.chosen).toHaveLength(2);
    expect(result.current.drafts['obs-1'].accountId).toBe('account-1');
    expect(result.current.drafts['obs-2'].accountId).toBe('account-1');
  });

  it('suggests a known merchant category when an uncategorized OCR row is opened', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ category_id: 'shopping-id', source: 'catalog' }));
    vi.stubGlobal('fetch', fetchMock);
    const shopping = {
      id: 'shopping-id',
      name: 'Shopping',
      type: 'expense',
      is_active: true,
    } as Category;
    const { result } = renderReview([shopping]);
    const amazon = { ...rows[0], counterparty: 'AMAZON.COM', description: 'Amazon purchase' };

    act(() => result.current.editRow(amazon));

    await waitFor(() => expect(result.current.drafts['obs-1'].categoryId).toBe('shopping-id'));
    expect(fetchMock).toHaveBeenCalledWith('/api/merchant-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: 'AMAZON.COM' }),
    });
    expect(result.current.aiHints['obs-1']).toBe('Shopping');
    act(() => result.current.editRow(amazon));
    act(() => result.current.editRow(amazon));
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('keeps a category chosen while a merchant suggestion is loading', async () => {
    let finishRequest!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (finishRequest = resolve))),
    );
    const categories = [
      { id: 'shopping-id', name: 'Shopping', type: 'expense', is_active: true },
      { id: 'gift-id', name: 'Gifts', type: 'expense', is_active: true },
    ] as Category[];
    const { result } = renderReview(categories);
    const amazon = { ...rows[0], counterparty: 'AMAZON.COM' };

    act(() => result.current.editRow(amazon));
    act(() => result.current.updateDraft('obs-1', { categoryId: 'gift-id' }));
    await act(async () =>
      finishRequest(Response.json({ category_id: 'shopping-id', source: 'catalog' })),
    );

    expect(result.current.drafts['obs-1'].categoryId).toBe('gift-id');
    vi.unstubAllGlobals();
  });
});
