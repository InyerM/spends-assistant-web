import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { z } from 'zod';
export function useDocumentPreview(id: string): UseQueryResult<{ url: string }> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['document-preview', owner, id],
    enabled: Boolean(owner),
    staleTime: 60_000,
    gcTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/documents/${id}/inspect`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Document preview unavailable');
      return z.object({ url: z.url() }).parse(await response.json());
    },
  });
}
