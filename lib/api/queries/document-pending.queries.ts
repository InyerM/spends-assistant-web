import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';

export async function fetchPendingDocumentCount(signal?: AbortSignal): Promise<number> {
  const response = await fetch('/api/documents/pending-count', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Could not load pending documents');
  const body = (await response.json()) as { count: number };
  return body.count;
}

export function usePendingDocumentCount(): UseQueryResult<number, Error> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['documents', 'pending-count', owner ?? null],
    queryFn: ({ signal }) => fetchPendingDocumentCount(signal),
    enabled: Boolean(owner),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
