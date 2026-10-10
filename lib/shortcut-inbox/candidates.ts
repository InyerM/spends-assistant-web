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

function parseAmount(raw: string): string | null {
  const text = raw.replace(/[.,]$/u, '');
  let decimal: string;
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/u.test(text))
    decimal = text.replaceAll('.', '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/u.test(text)) decimal = text.replaceAll(',', '');
  else if (/^\d{1,3}(?:[.,]\d{3})+$/u.test(text)) decimal = text.replaceAll(/[.,]/gu, '');
  else if (/^\d+[.,]\d{1,2}$/u.test(text)) decimal = text.replace(',', '.');
  else if (/^\d+$/u.test(text)) decimal = text;
  else return null;
  const amount = Number(decimal);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999_999) return null;
  return amount.toFixed(2);
}

function parseDate(day: number, month: number, year: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > lastDay) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Conservative extraction only: no inferred dates, amounts, or accounts. */
export function extractCandidateEvidence(rawText: string): CandidateEvidence {
  const amountTokens = Array.from(
    rawText.matchAll(
      /\b(?:compraste|pagaste|transferiste|enviaste|retiraste|recibiste|consignaste)\b[^$\n]{0,45}\$\s*([0-9][0-9.,]*)/giu,
    ),
  );
  if (amountTokens.length === 0) return { amount: null, date: null, lastFour: null };
  const amount = amountTokens.length === 1 ? parseAmount(amountTokens[0][1]) : null;
  const dates = Array.from(
    rawText.matchAll(/\b(?:(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/gu),
  );
  const date =
    dates.length === 1
      ? dates[0][1]
        ? parseDate(Number(dates[0][1]), Number(dates[0][2]), Number(dates[0][3]))
        : parseDate(Number(dates[0][6]), Number(dates[0][5]), Number(dates[0][4]))
      : null;
  const accountSuffixes = Array.from(
    rawText.matchAll(/\b(?:T\.?Deb|T\.?Cred|tarjeta|cuenta)\b[^*\n]{0,40}\*{1,4}(\d{4})\b/giu),
  );
  const lastFour = accountSuffixes.length === 1 ? accountSuffixes[0][1] : null;
  return { amount, date: amount ? date : null, lastFour };
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
