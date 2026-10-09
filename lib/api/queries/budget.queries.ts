import { useQuery } from '@tanstack/react-query';

export interface BudgetStatus {
  budget_id: string;
  category_id: string;
  repeat_monthly?: boolean;
  start_month?: string;
  limit_cop: string;
  spent_cop: string;
  pending_count: number;
  unknown_currency_count: number;
  excluded_count: number;
  threshold: 'none' | '80' | '100';
  contributing_transactions: BudgetTransaction[];
}

export interface BudgetTransaction {
  id: string;
  date: string;
  description: string;
  category_id: string;
  amount: number;
}

export const budgetKeys = {
  all: ['budgets'] as const,
  month: (month: string) => [...budgetKeys.all, month] as const,
};

export async function fetchMonthlyBudgets(month: string): Promise<BudgetStatus[]> {
  const response = await fetch(`/api/budgets?month=${encodeURIComponent(month)}`);
  if (!response.ok) throw new Error('Could not load monthly budgets');
  const body = (await response.json()) as { data: BudgetStatus[] };
  return body.data;
}

export function useMonthlyBudgets(month: string): ReturnType<typeof useQuery<BudgetStatus[]>> {
  return useQuery({
    queryKey: budgetKeys.month(month),
    queryFn: () => fetchMonthlyBudgets(month),
  });
}
