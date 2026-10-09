import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useDocumentBulkReconciliation } from '@/hooks/use-document-bulk-reconciliation';
import { decideDocumentObservation } from '@/lib/api/mutations/document.mutations';
import { rankCandidates } from '@/lib/document-reconciliation';

vi.mock('@/lib/api/mutations/document.mutations', () => ({ decideDocumentObservation: vi.fn() }));
const row = {
  id: 'obs-1',
  amount: -12000,
  currency: 'COP',
  confidence: 0.95,
  status: 'pending',
  occurred_at_text: '2026-09-28',
  description: 'Cafe North',
  counterparty: null,
  reference: null,
};
const candidate = rankCandidates(row, [
  {
    id: 'tx-1',
    amount: 12000,
    currency: 'COP',
    date: '2026-09-28',
    description: 'Cafe North',
    account_id: 'account-1',
    account_name: 'Checking',
    type: 'expense',
    raw_text: null,
  },
])[0];
const group = {
  observation_id: row.id,
  status: 'pending',
  candidates: [candidate],
  total_candidates: 1,
  search_limited: false,
};
function setup() {
  const onRefresh = vi.fn().mockResolvedValue(undefined);
  const onBusyChange = vi.fn();
  const hook = renderHook(() =>
    useDocumentBulkReconciliation({
      documentId: 'doc-1',
      rows: [row],
      suggestions: [group],
      onRefresh,
      disabled: false,
      onBusyChange,
    }),
  );
  return { ...hook, onRefresh, onBusyChange };
}

describe('useDocumentBulkReconciliation', () => {
  beforeEach(() => vi.mocked(decideDocumentObservation).mockReset());
  it('writes nothing until the reviewer opens and explicitly confirms the preview', async () => {
    vi.mocked(decideDocumentObservation).mockResolvedValue(undefined);
    const { result, onRefresh, onBusyChange } = setup();
    await act(async () => result.current.confirm());
    expect(decideDocumentObservation).not.toHaveBeenCalled();
    act(() => result.current.openPreview());
    expect(result.current.preview).toHaveLength(1);
    await act(async () => result.current.confirm());
    expect(decideDocumentObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'doc-1',
        observationId: 'obs-1',
        transactionId: 'tx-1',
        action: 'accept',
        key: expect.any(String),
      }),
    );
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
    expect(result.current.eligible).toHaveLength(0);
  });
  it('reuses the decision key after a transport failure and leaves failures reviewable', async () => {
    vi.mocked(decideDocumentObservation)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);
    const { result } = setup();
    act(() => result.current.openPreview());
    await act(async () => result.current.confirm());
    const key = vi.mocked(decideDocumentObservation).mock.calls[0][0].key;
    expect(result.current.failed).toBe(1);
    expect(result.current.eligible).toHaveLength(1);
    act(() => result.current.openPreview());
    await act(async () => result.current.confirm());
    expect(vi.mocked(decideDocumentObservation).mock.calls[1][0].key).toBe(key);
  });
  it('skips a preview whose current suggestion is no longer eligible', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ limited }) =>
        useDocumentBulkReconciliation({
          documentId: 'doc-1',
          rows: [row],
          suggestions: [{ ...group, search_limited: limited }],
          onRefresh,
          disabled: false,
        }),
      { initialProps: { limited: false } },
    );
    act(() => result.current.openPreview());
    rerender({ limited: true });
    await act(async () => result.current.confirm());
    expect(decideDocumentObservation).not.toHaveBeenCalled();
  });
});
