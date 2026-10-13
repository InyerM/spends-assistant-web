import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';

export async function fetchPendingInboxCount(signal?: AbortSignal): Promise<number> {
  const response = await fetch('/api/shortcut-inbox/pending-count', { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Could not load pending reviews');
  const body = (await response.json()) as { count: number };
  return body.count;
}

export function usePendingInboxCount(): UseQueryResult<number, Error> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['shortcut-inbox', 'pending-count', owner ?? null],
    queryFn: ({ signal }) => fetchPendingInboxCount(signal),
    enabled: Boolean(owner),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
