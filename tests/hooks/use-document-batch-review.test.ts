import { act, renderHook } from '@testing-library/react';
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

function renderReview() {
  return renderHook(() =>
    useDocumentBatchReview({
      documentId: 'doc-1',
      rows,
      history: [],
      accounts,
      categories: [] as Category[],
      suggestions: [],
      onRefresh: vi.fn().mockResolvedValue(undefined),
    }),
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
});
