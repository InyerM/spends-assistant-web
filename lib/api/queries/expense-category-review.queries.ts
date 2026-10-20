import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import type { ExpenseReviewPage } from '@/types/expense-category-review';
export function useExpenseCategoryQueue(filters: {
  scope: 'uncategorized' | 'all';
  search: string;
  page: number;
}): ReturnType<typeof useQuery<ExpenseReviewPage>> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['expense-category-review', owner, filters],
    enabled: Boolean(owner),
    queryFn: async () => {
      const response = await fetch(
        '/api/transactions/category-review?' +
          new URLSearchParams({
            scope: filters.scope,
            search: filters.search,
            page: String(filters.page),
          }).toString(),
      );
      if (!response.ok) throw new Error('Review queue unavailable');
      return response.json() as Promise<ExpenseReviewPage>;
    },
  });
}
