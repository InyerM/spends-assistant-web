import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
export interface PurchaseLocation {
  transaction_id: string;
  inbox_item_id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  latitude: number;
  longitude: number;
  captured_at: string;
  total_count: number;
}
export function usePurchaseLocations(
  offset: number,
): ReturnType<typeof useQuery<PurchaseLocation[]>> {
  const owner = useAuthStore((s) => s.supabaseUser?.id);
  return useQuery({
    queryKey: ['purchase-locations', owner, offset],
    enabled: Boolean(owner),
    queryFn: async ({ signal }): Promise<PurchaseLocation[]> => {
      const response = await fetch(`/api/purchase-locations?offset=${offset}`, { signal });
      if (!response.ok) throw new Error('Locations unavailable');
      return response.json() as Promise<PurchaseLocation[]>;
    },
  });
}
