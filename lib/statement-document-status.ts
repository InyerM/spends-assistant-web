import type { StatementProof } from '@/lib/statement-reconciliation';
export function withStatementProofs<
  T extends {
    id: string;
    document_type: string | null;
    document_observations: Array<{ id: string; status: string }>;
  },
>(document: T, proofs: StatementProof[]): T & { statement_proofs: StatementProof[] } {
  const evidence = proofs.filter((proof) => proof.document_id === document.id);
  return {
    ...document,
    statement_proofs: evidence,
    document_observations: document.document_observations.map((row) => ({
      ...row,
      status:
        document.document_type === 'statement' &&
        evidence.some((proof) => proof.observation_id === row.id && proof.valid)
          ? 'reconciled'
          : row.status,
    })),
  };
}
