import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentBulkReconciliation } from '@/components/documents/document-bulk-reconciliation';
import { decideDocumentObservation } from '@/lib/api/mutations/document.mutations';
import { rankCandidates } from '@/lib/document-reconciliation';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}));
vi.mock('@/lib/api/mutations/document.mutations', () => ({
  decideDocumentObservation: vi.fn().mockResolvedValue(undefined),
}));

describe('DocumentBulkReconciliation', () => {
  it('previews existing ledger links before making audited decisions', async () => {
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
    render(
      <DocumentBulkReconciliation
        documentId='doc-1'
        rows={[row]}
        suggestions={[
          {
            observation_id: row.id,
            status: 'pending',
            candidates: [candidate],
            total_candidates: 1,
            search_limited: false,
          },
        ]}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        disabled={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'bulkReconcile' }));
    expect(screen.getByRole('link')).toHaveAttribute('href', '/transactions/tx-1');
    expect(screen.getByText('bulkReconcileWarning')).toBeVisible();
    expect(decideDocumentObservation).not.toHaveBeenCalled();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'bulkReconcileConfirm' })),
    );
    await waitFor(() => expect(decideDocumentObservation).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('bulkReconcileResult');
  });
});
