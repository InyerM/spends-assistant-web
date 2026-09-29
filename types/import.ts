export interface ImportDuplicateMatch {
  id: string;
  date: string;
  amount: number;
  description: string;
  account_id: string;
}

/** One existing transaction that matches the CSV row at `index`. */
export interface ImportDuplicate {
  index: number;
  match: ImportDuplicateMatch;
}

export type DuplicateDecision = 'import' | 'skip';

/** The user's explicit decision for a flagged row, pinned to the matches they saw. */
export interface DuplicateReview {
  index: number;
  match_ids: string[];
  decision: DuplicateDecision;
}

export interface DuplicateCandidateRow {
  date: string;
  amount: number;
  account_id: string | null;
}

export interface DuplicateCandidateGroup {
  key: string;
  date: string;
  amount: number;
  account_id: string;
  indices: number[];
}

export interface DuplicateReviewEvaluation {
  unreviewed: number[];
  stale: number[];
  skipIndices: Set<number>;
  confirmedIndices: Set<number>;
}
