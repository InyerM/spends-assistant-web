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
  currency: { value: string; reason: 'source' | 'account' | 'review' | 'default' } | null;
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

export function inferDocumentTransactionType(
  amount: number | null,
  description: string,
  sourceExcerpt: string,
): 'expense' | 'income' {
  if (amount !== null && amount < 0) return 'expense';
  const evidence = normalize(`${description} ${sourceExcerpt}`);
  if (
    /\b(recibiste|recibio|recibido|ingreso|deposito|consignacion|refund|refunded)\b/.test(
      evidence,
    ) ||
    /\b(transferencia|abono|pago) recibido\b/.test(evidence) ||
    /\bte enviaron\b/.test(evidence)
  )
    return 'income';
  // OCR often returns a positive absolute total for purchases, especially receipts.
  // An unsigned amount alone is not evidence of an incoming transfer.
  return 'expense';
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
  else if (!sourceCurrency && accountCurrency === 'COP' && accountCurrency !== observation.currency)
    currency = { value: accountCurrency, reason: 'account' };
  else if (!sourceCurrency && correctedCurrency && correctedCurrency !== observation.currency)
    currency = { value: correctedCurrency, reason: 'review' };
  else if (!sourceCurrency && observation.currency !== 'COP')
    currency = { value: 'COP', reason: 'default' };

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

interface EvidenceAccount {
  id: string;
  institution: string | null;
  name: string;
  last_four: string | null;
  bank_account_last_four?: string | null;
  currency: string;
  is_active: boolean;
}

export function inferAccountFromEvidence(
  evidence: string,
  accounts: EvidenceAccount[],
): { accountId: string; basis: 'suffix' } | null {
  const normalized = normalize(evidence);
  const suffixes = [
    ...evidence.matchAll(
      /(?:\*|(?:cuenta|tarjeta|terminad[ao]? en|t\.?d\.?|t\.?c\.?)\s*)(\d{4})\b/gi,
    ),
  ].map((match) => match[1]);
  if (suffixes.length === 0) return null;
  const candidates = accounts.filter(
    (account) =>
      account.is_active &&
      account.currency === 'COP' &&
      [account.last_four, account.bank_account_last_four].some(
        (suffix) => suffix && suffixes.includes(suffix),
      ) &&
      (!account.institution ||
        normalized.includes(normalize(account.institution)) ||
        normalized.includes(normalize(account.name))),
  );
  return candidates.length === 1 ? { accountId: candidates[0].id, basis: 'suffix' } : null;
}

interface HistoryTransaction {
  description: string;
  type: string;
  category_id: string | null;
}

function merchantTokens(value: string): Set<string> {
  const generic = new Set([
    'compra',
    'compras',
    'pago',
    'pagos',
    'supermercado',
    'mercado',
    'transferencia',
    'recibo',
  ]);
  return new Set(
    normalize(value)
      .split(' ')
      .filter((token) => token.length >= 4 && !generic.has(token))
      .map((token) => (token.endsWith('s') ? token.slice(0, -1) : token)),
  );
}

export function inferCategoryFromHistory(
  merchant: string,
  history: HistoryTransaction[],
): { type: string; categoryId: string; evidenceCount: number } | null {
  const target = merchantTokens(merchant);
  if (target.size === 0) return null;
  const counts = new Map<string, number>();
  for (const transaction of history) {
    if (!transaction.category_id) continue;
    const candidate = merchantTokens(transaction.description);
    const shared = [...target].filter((token) => candidate.has(token)).length;
    if (shared < 1 || shared / Math.max(target.size, candidate.size) < 0.8) continue;
    const key = `${transaction.type}:${transaction.category_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  if (!ranked[0] || ranked[0][1] < 2 || (ranked[1] && ranked[0][1] <= ranked[1][1] * 2))
    return null;
  const [type, categoryId] = ranked[0][0].split(':');
  return { type, categoryId, evidenceCount: ranked[0][1] };
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
