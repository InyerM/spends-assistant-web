export interface ReviewHistoryObservation {
  id: string;
  description: string;
  counterparty?: string | null;
  source_excerpt: string;
  currency: string | null;
  document_type: string | null;
  status?: string;
  reviewed_at?: string | null;
  extracted_snapshot?: { currency?: string | null } | null;
  matched_transaction?: {
    type: string;
    category_id: string | null;
    account_id: string;
  } | null;
}

export interface DocumentReviewSuggestion {
  currency: { value: string; reason: 'source' | 'account' | 'review' } | null;
  transaction: { type: string; categoryId: string | null; accountId: string } | null;
  previouslyRejected: boolean;
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function explicitCurrency(value: string): string | null {
  if (/\b(?:USD|USDT|dollars?|dolares?)\b|US\$/i.test(normalize(value)) || /US\$/i.test(value))
    return 'USD';
  if (/\b(?:COP|pesos|colombianos?)\b|COL\$/i.test(normalize(value)) || /COL\$/i.test(value))
    return 'COP';
  return null;
}

function mostCommon<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length > 1 && ranked[0][1] === ranked[1][1] ? null : ranked[0][0];
}

export function suggestDocumentReview(
  observation: ReviewHistoryObservation,
  history: ReviewHistoryObservation[],
  accountCurrency: string | null,
): DocumentReviewSuggestion {
  const key = normalize(observation.counterparty || observation.description);
  const similar = history.filter(
    (item) =>
      item.id !== observation.id && normalize(item.counterparty || item.description) === key,
  );
  const sourceCurrency = explicitCurrency(observation.source_excerpt);
  const correctedCurrency = mostCommon(
    history
      .filter(
        (item) =>
          item.id !== observation.id &&
          item.document_type === observation.document_type &&
          item.reviewed_at &&
          item.extracted_snapshot?.currency === observation.currency &&
          item.currency !== observation.currency &&
          item.currency,
      )
      .map((item) => item.currency as string),
  );
  let currency: DocumentReviewSuggestion['currency'] = null;
  if (sourceCurrency && sourceCurrency !== observation.currency)
    currency = { value: sourceCurrency, reason: 'source' };
  else if (!sourceCurrency && accountCurrency && accountCurrency !== observation.currency)
    currency = { value: accountCurrency, reason: 'account' };
  else if (!sourceCurrency && correctedCurrency && correctedCurrency !== observation.currency)
    currency = { value: correctedCurrency, reason: 'review' };

  const confirmed = similar.filter(
    (item) => item.status === 'confirmed' && item.matched_transaction,
  );
  const transactionPattern = mostCommon(
    confirmed.map((item) =>
      JSON.stringify({
        type: item.matched_transaction!.type,
        categoryId: item.matched_transaction!.category_id,
        accountId: item.matched_transaction!.account_id,
      }),
    ),
  );
  return {
    currency,
    transaction: transactionPattern
      ? (JSON.parse(transactionPattern) as DocumentReviewSuggestion['transaction'])
      : null,
    previouslyRejected: similar.some((item) => item.status === 'rejected'),
  };
}

export interface ApprovalDraft {
  amount: string;
  currency: string;
  date: string;
  time: string;
  description: string;
  type: 'expense' | 'income' | 'transfer';
  accountId: string;
  destinationAccountId: string;
}

export function validateDocumentDraft(
  draft: ApprovalDraft,
  accounts: Array<{ id: string; currency: string; is_active: boolean }>,
): string[] {
  const errors: string[] = [];
  const amount = Number(draft.amount);
  if (
    !/^\d+(?:\.\d{1,2})?$/.test(draft.amount) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 9_999_999_999_999.99
  )
    errors.push('amount');
  if (draft.currency !== 'COP') errors.push('currency');
  const account = accounts.find((item) => item.id === draft.accountId && item.is_active);
  if (!account) errors.push('account');
  else if (account.currency !== draft.currency) errors.push('currency');
  const parsedDate = new Date(`${draft.date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== draft.date
  )
    errors.push('date');
  if (draft.time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) errors.push('time');
  if (!draft.description.trim()) errors.push('description');
  if (
    draft.type === 'transfer' &&
    !accounts.some(
      (item) =>
        item.id === draft.destinationAccountId &&
        item.is_active &&
        item.currency === draft.currency &&
        item.id !== draft.accountId,
    )
  )
    errors.push('destination');
  return errors;
}
