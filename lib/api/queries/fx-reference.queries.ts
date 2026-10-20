import { useQuery } from '@tanstack/react-query';
import type { UsdCopReference } from '@/lib/fx-reference';
export function useFxReference(date: string): ReturnType<typeof useQuery<UsdCopReference>> {
  return useQuery({
    queryKey: ['fx-reference', date],
    enabled: Boolean(date),
    retry: false,
    staleTime: 3600000,
    queryFn: async () => {
      const response = await fetch('/api/fx-reference?' + new URLSearchParams({ date }).toString());
      if (!response.ok) throw new Error('Reference unavailable');
      return response.json() as Promise<UsdCopReference>;
    },
  });
}
