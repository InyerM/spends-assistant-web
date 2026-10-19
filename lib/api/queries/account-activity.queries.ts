import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
export interface AccountActivity {
  months: Array<{ month: string; income: number; expenses: number; count: number }>;
  categories: Array<{
    category_id: string | null;
    name: string | null;
    translations: Record<string, string> | null;
    amount: number;
  }>;
  count: number;
  income: number;
  expenses: number;
  period_start: string;
  period_end: string;
}
export function useAccountActivity(id: string): ReturnType<typeof useQuery<AccountActivity>> {
  const owner = useAuthStore((s) => s.supabaseUser?.id);
  return useQuery({
    queryKey: ['accounts', 'activity', owner, id],
    enabled: Boolean(owner && id),
    queryFn: async () => {
      const response = await fetch(`/api/accounts/${id}/activity`);
      if (!response.ok) throw new Error('Account activity unavailable');
      return response.json() as Promise<AccountActivity>;
    },
  });
}
