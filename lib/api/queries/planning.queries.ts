import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import type { PlanningSnapshot } from '@/lib/planning';
export function usePlanning(): ReturnType<typeof useQuery<PlanningSnapshot>> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['planning', owner],
    enabled: Boolean(owner),
    queryFn: async ({ signal }): Promise<PlanningSnapshot> => {
      const response = await fetch('/api/planning', { signal });
      if (!response.ok) throw new Error('Planning unavailable');
      return response.json() as Promise<PlanningSnapshot>;
    },
  });
}
