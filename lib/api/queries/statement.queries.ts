import { useAuthStore } from '@/store/auth-store';
import { useQuery } from '@tanstack/react-query';
import type { StatementProof, StatementReview } from '@/lib/statement-reconciliation';
export function useStatementProofs(ids: string[]): ReturnType<typeof useQuery<StatementProof[]>> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  const stable = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['transactions', 'statement-proofs', owner, stable],
    enabled: Boolean(owner) && stable.length > 0,
    queryFn: async (): Promise<StatementProof[]> => {
      const chunks: string[][] = [];
      for (let i = 0; i < stable.length; i += 100) chunks.push(stable.slice(i, i + 100));
      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch(`/api/statements/proofs?ids=${chunk.join(',')}`);
          if (!response.ok) throw new Error('Could not load statement evidence');
          const body = (await response.json()) as { data: StatementProof[] };
          return body.data;
        }),
      );
      return results.flat();
    },
  });
}

export function useStatementReconciliation(
  documentId: string,
): ReturnType<typeof useQuery<StatementReview>> {
  return useQuery({
    queryKey: ['documents', documentId, 'reconciliation'],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${documentId}/reconciliation`);
      if (!response.ok) throw new Error('Could not load reconciliation');
      return response.json() as Promise<StatementReview>;
    },
  });
}
