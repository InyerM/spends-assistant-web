import type {
  DuplicateCandidateGroup,
  DuplicateCandidateRow,
  DuplicateDecision,
  DuplicateReview,
  DuplicateReviewEvaluation,
  ImportDuplicate,
  ImportDuplicateMatch,
} from '@/types/import';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECISIONS: ReadonlySet<string> = new Set<DuplicateDecision>(['import', 'skip']);

export function duplicateKey(date: string, amount: number, accountId: string): string {
  return `${date}|${Number(amount)}|${accountId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates the fields used for matching and filtering. Dates are interpolated into a
 * PostgREST filter, so anything other than YYYY-MM-DD is rejected.
 */
export function validateImportRows(rows: unknown): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return 'No transactions provided';
  for (let i = 0; i < rows.length; i++) {
    const row: unknown = rows[i];
    const label = `Invalid transaction at row ${i + 1}`;
    if (!isRecord(row)) return label;
    if (typeof row.date !== 'string' || !ISO_DATE.test(row.date)) return `${label}: date`;
    if (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount < 0) {
      return `${label}: amount`;
    }
    if (!isNonEmptyString(row.account_id) && !isNonEmptyString(row.account)) {
      return `${label}: account`;
    }
  }
  return null;
}

export function groupDuplicateCandidates(rows: DuplicateCandidateRow[]): DuplicateCandidateGroup[] {
  const groups: DuplicateCandidateGroup[] = [];
  const byKey = new Map<string, DuplicateCandidateGroup>();
  rows.forEach((row, index) => {
    if (!row.account_id) return;
    const key = duplicateKey(row.date, row.amount, row.account_id);
    const existing = byKey.get(key);
    if (existing) {
      existing.indices.push(index);
      return;
    }
    const group = {
      key,
      date: row.date,
      amount: row.amount,
      account_id: row.account_id,
      indices: [index],
    };
    byKey.set(key, group);
    groups.push(group);
  });
  return groups;
}

export function buildDuplicateOrFilter(groups: DuplicateCandidateGroup[]): string {
  return groups
    .map((g) => `and(date.eq.${g.date},amount.eq.${g.amount},account_id.eq.${g.account_id})`)
    .join(',');
}

export function mapMatchesToDuplicates(
  groups: DuplicateCandidateGroup[],
  matches: ImportDuplicateMatch[],
): ImportDuplicate[] {
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const duplicates: ImportDuplicate[] = [];
  for (const m of matches) {
    const group = byKey.get(duplicateKey(m.date, m.amount, m.account_id));
    if (!group) continue;
    const match: ImportDuplicateMatch = {
      id: m.id,
      date: m.date,
      amount: Number(m.amount),
      description: m.description,
      account_id: m.account_id,
    };
    for (const index of group.indices) duplicates.push({ index, match });
  }
  return duplicates.toSorted((a, b) => a.index - b.index);
}

function groupMatchIdsByIndex(duplicates: ImportDuplicate[]): Map<number, string[]> {
  const byIndex = new Map<number, string[]>();
  for (const d of duplicates) {
    const ids = byIndex.get(d.index);
    if (ids) ids.push(d.match.id);
    else byIndex.set(d.index, [d.match.id]);
  }
  return byIndex;
}

export function parseDuplicateReviews(
  raw: unknown,
  rowCount: number,
): { reviews: DuplicateReview[] } | { error: string } {
  if (raw === undefined || raw === null) return { reviews: [] };
  if (!Array.isArray(raw)) return { error: 'duplicate_reviews must be an array' };

  const seen = new Set<number>();
  const reviews: DuplicateReview[] = [];
  for (const item of raw as unknown[]) {
    if (!isRecord(item)) return { error: 'Invalid duplicate review' };
    const { index, match_ids: matchIds, decision } = item;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= rowCount) {
      return { error: 'Duplicate review index out of range' };
    }
    if (seen.has(index)) return { error: `Duplicate review repeated for row ${index + 1}` };
    if (typeof decision !== 'string' || !DECISIONS.has(decision)) {
      return { error: 'Duplicate review decision must be "import" or "skip"' };
    }
    if (!Array.isArray(matchIds) || matchIds.length === 0 || !matchIds.every(isNonEmptyString)) {
      return { error: 'Duplicate review must list the reviewed match ids' };
    }
    seen.add(index);
    reviews.push({ index, match_ids: matchIds, decision: decision as DuplicateDecision });
  }
  return { reviews };
}

/**
 * Compares the matches found at write time with the user's reviews. A row is
 * `unreviewed` when it has matches but no review, and `stale` when its review does
 * not cover every current match (e.g. a match appeared after preview, or the
 * same request is replayed after its rows were inserted).
 */
export function evaluateDuplicateReviews(
  duplicates: ImportDuplicate[],
  reviews: DuplicateReview[],
): DuplicateReviewEvaluation {
  const matchIdsByIndex = groupMatchIdsByIndex(duplicates);
  const reviewByIndex = new Map(reviews.map((r) => [r.index, r]));
  const result: DuplicateReviewEvaluation = {
    unreviewed: [],
    stale: [],
    skipIndices: new Set(),
    confirmedIndices: new Set(),
  };

  for (const [index, matchIds] of matchIdsByIndex) {
    const review = reviewByIndex.get(index);
    if (!review) {
      result.unreviewed.push(index);
      continue;
    }
    const reviewed = new Set(review.match_ids);
    if (!matchIds.every((id) => reviewed.has(id))) {
      result.stale.push(index);
      continue;
    }
    if (review.decision === 'skip') result.skipIndices.add(index);
    else result.confirmedIndices.add(index);
  }

  // A skip on a row that no longer matches anything is still honored: skipping never writes.
  for (const review of reviews) {
    if (!matchIdsByIndex.has(review.index) && review.decision === 'skip') {
      result.skipIndices.add(review.index);
    }
  }

  result.unreviewed.sort((a, b) => a - b);
  result.stale.sort((a, b) => a - b);
  return result;
}

export function buildDuplicateReviews(
  duplicates: ImportDuplicate[],
  decision: DuplicateDecision,
): DuplicateReview[] {
  return [...groupMatchIdsByIndex(duplicates)]
    .toSorted(([a], [b]) => a - b)
    .map(([index, matchIds]) => ({ index, match_ids: matchIds, decision }));
}

export interface ImportRowFields {
  date: string;
  time?: string | null;
  amount: number;
  description?: string | null;
  notes?: string | null;
  type?: string | null;
  payment_method?: string | null;
  source?: string | null;
}

export interface ImportInsertContext {
  userId: string;
  importId: string;
  accountId: string;
  categoryId: string | null;
  confirmedDuplicate: boolean;
}

/** Builds the transaction insert from whitelisted CSV fields only. */
export function buildImportInsertRow(
  row: ImportRowFields,
  ctx: ImportInsertContext,
): Record<string, unknown> {
  return {
    date: row.date,
    time: row.time ?? '12:00:00',
    amount: row.amount,
    description: row.description ?? '',
    notes: row.notes ?? null,
    type: row.type ?? 'expense',
    payment_method: row.payment_method ?? null,
    source: row.source ?? 'csv_import',
    account_id: ctx.accountId,
    category_id: ctx.categoryId,
    user_id: ctx.userId,
    import_id: ctx.importId,
    ...(ctx.confirmedDuplicate ? { duplicate_status: 'confirmed' } : {}),
  };
}
