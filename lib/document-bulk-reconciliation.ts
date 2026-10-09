import type { DocumentSuggestionGroup } from '@/lib/api/queries/document.queries';
import type {
  ReconciliationCandidate,
  ReconciliationObservation,
} from '@/lib/document-reconciliation';

export interface BulkReconciliationRow extends Pick<
  ReconciliationObservation,
  'id' | 'amount' | 'currency' | 'occurred_at_text'
> {
  status: string;
  confidence: number;
}
export interface BulkReconciliationMatch {
  observationId: string;
  candidate: ReconciliationCandidate;
}
export function selectBulkReconciliation(
  rows: BulkReconciliationRow[],
  suggestions: DocumentSuggestionGroup[],
): BulkReconciliationMatch[] {
  const pending = new Map(
    rows.filter((row) => row.status === 'pending').map((row) => [row.id, row]),
  );
  const uses = new Map<string, Set<string>>();
  for (const group of suggestions) {
    if (!pending.has(group.observation_id) || group.status !== 'pending') continue;
    for (const candidate of group.candidates) {
      const observations = uses.get(candidate.transaction_id) ?? new Set<string>();
      observations.add(group.observation_id);
      uses.set(candidate.transaction_id, observations);
    }
  }
  return suggestions.flatMap((group) => {
    const row = pending.get(group.observation_id);
    if (
      !row ||
      row.confidence < 0.9 ||
      !Number.isFinite(row.confidence) ||
      group.status !== 'pending' ||
      group.search_limited ||
      group.total_candidates !== 1 ||
      group.candidates.length !== 1
    )
      return [];
    const candidate = group.candidates[0];
    if (
      !row.currency ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      candidate.currency !== row.currency ||
      row.amount === null ||
      Math.abs(row.amount) !== candidate.amount ||
      row.occurred_at_text?.slice(0, 10) !== candidate.date.slice(0, 10) ||
      candidate.basis !== 'exact_date' ||
      candidate.days_apart !== 0 ||
      candidate.amount_difference !== 0 ||
      !['expense', 'income'].includes(candidate.type) ||
      (!candidate.reference_hint && !candidate.description_hint) ||
      uses.get(candidate.transaction_id)?.size !== 1
    )
      return [];
    return [{ observationId: row.id, candidate }];
  });
}
