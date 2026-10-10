import { extractEmailEventEvidence } from './email-event-evidence';
import type { CandidateReview } from '@/lib/api/mutations/shortcut-inbox.mutations';
export interface CandidateEvidence {
  amount: string | null;
  date: string | null;
  lastFour: string | null;
}

export interface CandidateTransaction {
  id: string;
  date: string;
  amount: number;
  account_id: string;
  description: string;
  type: string;
  source: string;
}

export interface CandidateSuggestion {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: string;
  source: string;
  strength: 'strong' | 'possible';
  signals: Array<'exact_raw_text' | 'same_amount_date_account'>;
}

export const MAX_CANDIDATES = 10;

/** Both review and duplicate discovery consume the same explicit event evidence. */
export function extractCandidateEvidence(rawText: string): CandidateEvidence {
  const evidence = extractEmailEventEvidence(rawText);
  return { amount: evidence.amount, date: evidence.date, lastFour: evidence.sourceLastFour };
}

/** Every result is a suggestion; even a strong signal is never confirmation. */
export function rankCandidates(
  exactRaw: CandidateTransaction[],
  sameTuple: CandidateTransaction[],
  maximum = MAX_CANDIDATES,
): CandidateSuggestion[] {
  const byId = new Map<string, CandidateSuggestion>();
  for (const [rows, signal] of [
    [exactRaw, 'exact_raw_text'],
    [sameTuple, 'same_amount_date_account'],
  ] as const) {
    for (const row of rows) {
      const existing = byId.get(row.id);
      if (existing) {
        if (!existing.signals.includes(signal)) existing.signals.push(signal);
        continue;
      }
      byId.set(row.id, {
        id: row.id,
        date: row.date,
        amount: row.amount,
        description: row.description,
        type: row.type,
        source: row.source,
        strength: signal === 'exact_raw_text' ? 'strong' : 'possible',
        signals: [signal],
      });
    }
  }
  return [...byId.values()]
    .sort(
      (a, b) =>
        Number(b.strength === 'strong') - Number(a.strength === 'strong') ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, Math.min(maximum, MAX_CANDIDATES)));
}

/** Creation validation uses the final reviewed fields and takes precedence over raw-text hints. */
export function reviewCandidateSuggestions(review: CandidateReview): CandidateSuggestion[] {
  return review.candidates.map((candidate) => ({
    ...candidate,
    amount: Number(candidate.amount),
    type: '',
    strength: 'possible',
    signals: [],
  }));
}
