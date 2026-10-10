export interface StatementRow {
  id: string;
  amount: number | null;
  currency: string | null;
  occurred_at_text: string | null;
  status: string;
  description?: string;
}
export interface StatementTransaction {
  id: string;
  account_id: string;
  transfer_to_account_id: string | null;
  amount: number;
  currency: string;
  date: string;
  type: string;
  description?: string;
}
export interface StatementProof {
  id?: string;
  observation_id: string;
  transaction_id: string;
  valid: boolean;
  document_id?: string;
  file_name?: string;
}
export interface StatementScope {
  account_id: string;
  period_start: string;
  period_end: string;
}
export interface StatementReview {
  scope: StatementScope | null;
  rows: StatementRow[];
  transactions: StatementTransaction[];
  proofs: StatementProof[];
}
export function compareStatement(
  rows: StatementRow[],
  transactions: StatementTransaction[],
  proofs: StatementProof[],
  accountId: string,
): {
  statementOnly: StatementRow[];
  appOnly: StatementTransaction[];
  candidates: Record<string, string[]>;
} {
  const valid = proofs.filter((p) => p.valid);
  const linkedRows = new Set(valid.map((p) => p.observation_id));
  const linkedTransactions = new Set(valid.map((p) => p.transaction_id));
  const statementOnly = rows.filter((r) => r.status !== 'rejected' && !linkedRows.has(r.id));
  const appOnly = transactions.filter((t) => !linkedTransactions.has(t.id));
  const candidates: Record<string, string[]> = {};
  for (const row of statementOnly) {
    candidates[row.id] = appOnly
      .filter((t) => {
        const signed =
          t.type === 'income' ||
          (t.type === 'transfer' &&
            t.transfer_to_account_id === accountId &&
            t.account_id !== accountId)
            ? t.amount
            : -t.amount;
        return (
          row.amount !== null &&
          row.amount !== 0 &&
          row.currency === t.currency &&
          Math.round(row.amount * 100) === Math.round(signed * 100) &&
          row.occurred_at_text?.slice(0, 10) === t.date
        );
      })
      .map((t) => t.id);
  }
  return { statementOnly, appOnly, candidates };
}
