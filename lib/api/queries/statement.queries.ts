import { useQuery } from '@tanstack/react-query';
import type { StatementProof } from '@/lib/statement-reconciliation';
export function useStatementProofs(ids: string[]): ReturnType<typeof useQuery<StatementProof[]>> {
  const stable = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['transactions', 'statement-proofs', stable],
    enabled: stable.length > 0,
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
