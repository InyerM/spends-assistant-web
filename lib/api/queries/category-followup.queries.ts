import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
export interface CategoryFollowup {
  contact_name: string;
  category_id: string;
  category_name: string;
  source?: {
    id: string;
    type: 'expense' | 'income';
    description: string;
    notes: string | null;
    excerpt?: string | null;
  };
  evidence?: Array<{
    id: string;
    description: string;
    notes: string | null;
    category_id: string;
    category_name: string;
  }>;
  rows: Array<{
    id: string;
    category_id: string | null;
    category_name: string | null;
    is_uncategorized?: boolean;
    description: string;
    notes?: string | null;
    date: string;
    amount: number;
    currency: string;
  }>;
}
export function useCategoryFollowup(
  id: string | null,
  revision = 0,
): ReturnType<typeof useQuery<CategoryFollowup | null>> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['category-followup', owner, id, revision],
    enabled: Boolean(owner && id),
    queryFn: async () => {
      const response = await fetch(`/api/transactions/${id}/category-followup`);
      if (!response.ok) throw new Error('Category history unavailable');
      return response.json() as Promise<CategoryFollowup | null>;
    },
  });
}

export interface CategorySuggestion {
  contact_id: string;
  contact_name: string;
  transaction_id: string;
  category_id: string;
  category_name: string;
  count: number;
}
export function useCategorySuggestions(
  contactId?: string,
): ReturnType<typeof useQuery<CategorySuggestion[]>> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['category-suggestions', owner, contactId],
    enabled: Boolean(owner),
    queryFn: async () => {
      const response = await fetch(
        `/api/transactions/category-suggestions${contactId ? `?contact_id=${contactId}` : ''}`,
      );
      if (!response.ok) throw new Error('Category suggestions unavailable');
      return response.json() as Promise<CategorySuggestion[]>;
    },
  });
}
