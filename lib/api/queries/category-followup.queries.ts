import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
export interface CategoryFollowup {
  contact_name: string;
  category_id: string;
  category_name: string;
  rows: Array<{
    id: string;
    category_id: string | null;
    category_name: string | null;
    description: string;
    date: string;
    amount: number;
    currency: string;
  }>;
}
export function useCategoryFollowup(
  id: string | null,
): ReturnType<typeof useQuery<CategoryFollowup | null>> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['category-followup', owner, id],
    enabled: Boolean(owner && id),
    queryFn: async () => {
      const response = await fetch(`/api/transactions/${id}/category-followup`);
      if (!response.ok) throw new Error('Category history unavailable');
      return response.json() as Promise<CategoryFollowup | null>;
    },
  });
}
