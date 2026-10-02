import { inferDocumentTransactionType } from '@/lib/document-review';

export interface ReconciliationObservation {
  id: string;
  amount: number | null;
  occurred_at_text: string | null;
  description: string;
  counterparty: string | null;
  reference: string | null;
  source_excerpt?: string | null;
}

export interface ReconciliationTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  account_id: string;
  account_name: string | null;
  type: string;
  raw_text: string | null;
}

export interface ReconciliationCandidate {
  kind: 'candidate';
  transaction_id: string;
  amount: number;
  amount_difference: number;
  date: string;
  description: string;
  account_id: string;
  account_name: string | null;
  type: string;
  basis: 'exact_date' | 'near_date' | 'amount_only';
  days_apart: number | null;
  reference_hint: boolean;
  description_hint: boolean;
}

const DAY_MS = 86_400_000;

function parseDate(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null;
  const date = value.slice(0, 10);
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    return null;
  }
  return timestamp;
}

export function dateWindow(value: string | null): { from: string; to: string } | null {
  const timestamp = parseDate(value);
  if (timestamp === null) return null;
  return {
    from: new Date(timestamp - 3 * DAY_MS).toISOString().slice(0, 10),
    to: new Date(timestamp + 3 * DAY_MS).toISOString().slice(0, 10),
  };
}

function normalizedText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokens(value: string): Set<string> {
  return new Set(normalizedText(value).match(/[a-z0-9]{3,}/g) ?? []);
}

function amountCents(value: number): number | null {
  const cents = Math.round(value * 100);
  return Number.isFinite(value) && value > 0 && Number.isSafeInteger(cents) ? cents : null;
}

export function rankCandidates(
  observation: ReconciliationObservation,
  transactions: ReconciliationTransaction[],
): ReconciliationCandidate[] {
  const cents = observation.amount === null ? null : amountCents(Math.abs(observation.amount));
  if (cents === null) return [];
  const observedAt = parseDate(observation.occurred_at_text);
  const expectedType = inferDocumentTransactionType(
    observation.amount,
    observation.description,
    observation.source_excerpt ?? '',
  );
  const reference = normalizedText(observation.reference ?? '').replace(/[^a-z0-9]/g, '');
  const words = tokens(`${observation.description} ${observation.counterparty ?? ''}`);

  return transactions
    .flatMap((transaction) => {
      if (amountCents(transaction.amount) !== cents) return [];
      if (expectedType === 'income' ? transaction.type !== 'income' : transaction.type === 'income')
        return [];
      const transactionAt = parseDate(transaction.date);
      if (transactionAt === null) return [];
      const daysApart = observedAt === null ? null : Math.abs(transactionAt - observedAt) / DAY_MS;
      if (daysApart !== null && daysApart > 3) return [];
      const transactionWords = tokens(transaction.description);
      const descriptionHint = [...words].some((word) => transactionWords.has(word));
      const referenceHint =
        reference.length >= 5 &&
        normalizedText(`${transaction.raw_text ?? ''} ${transaction.description}`)
          .replace(/[^a-z0-9]/g, '')
          .includes(reference);
      return [
        {
          kind: 'candidate' as const,
          transaction_id: transaction.id,
          amount: transaction.amount,
          amount_difference: 0,
          date: transaction.date,
          description: transaction.description,
          account_id: transaction.account_id,
          account_name: transaction.account_name,
          type: transaction.type,
          basis:
            daysApart === null
              ? ('amount_only' as const)
              : daysApart === 0
                ? ('exact_date' as const)
                : ('near_date' as const),
          days_apart: daysApart,
          reference_hint: referenceHint,
          description_hint: descriptionHint,
        },
      ];
    })
    .sort((a, b) => {
      const dateRank = (candidate: ReconciliationCandidate): number =>
        candidate.days_apart === null ? 4 : candidate.days_apart;
      return (
        dateRank(a) - dateRank(b) ||
        Number(b.reference_hint) - Number(a.reference_hint) ||
        Number(b.description_hint) - Number(a.description_hint) ||
        a.transaction_id.localeCompare(b.transaction_id)
      );
    });
}
