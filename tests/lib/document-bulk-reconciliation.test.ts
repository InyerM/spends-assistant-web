import { describe, expect, it } from 'vitest';
import { selectBulkReconciliation } from '@/lib/document-bulk-reconciliation';
import { rankCandidates } from '@/lib/document-reconciliation';

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

describe('bulk document reconciliation eligibility', () => {
  it('selects only a unique exact match with verified currency and supporting text', () => {
    expect(selectBulkReconciliation([row], [group])).toEqual([
      { observationId: row.id, candidate },
    ]);
    for (const changed of [{ confidence: 0.8 }, { currency: null }, { status: 'confirmed' }]) {
      expect(selectBulkReconciliation([{ ...row, ...changed }], [group])).toEqual([]);
    }
    for (const changed of [{ search_limited: true }, { total_candidates: 2 }]) {
      expect(selectBulkReconciliation([row], [{ ...group, ...changed }])).toEqual([]);
    }
    for (const changed of [
      { basis: 'near_date' as const },
      { currency: 'USD' },
      { type: 'transfer' },
      { description_hint: false, reference_hint: false },
    ]) {
      expect(
        selectBulkReconciliation([row], [{ ...group, candidates: [{ ...candidate, ...changed }] }]),
      ).toEqual([]);
    }
  });

  it('leaves observations competing for the same transaction for manual review', () => {
    const second = { ...row, id: 'obs-2' };
    expect(
      selectBulkReconciliation([row, second], [group, { ...group, observation_id: second.id }]),
    ).toEqual([]);
    expect(
      selectBulkReconciliation(
        [row, second],
        [group, { ...group, observation_id: second.id, total_candidates: 2 }],
      ),
    ).toEqual([]);
  });
});
