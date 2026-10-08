import { useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetKeys } from '@/lib/api/queries/budget.queries';

export interface SaveBudgetInput {
  month: string;
  category_id: string;
  limit_cop: number;
}

export async function saveMonthlyBudget(input: SaveBudgetInput): Promise<string> {
  const response = await fetch('/api/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('Could not save monthly budget');
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function deactivateMonthlyBudget(budgetId: string): Promise<void> {
  const response = await fetch('/api/budgets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget_id: budgetId }),
  });
  if (!response.ok) throw new Error('Could not deactivate monthly budget');
}

export function useSaveMonthlyBudget(): ReturnType<
  typeof useMutation<string, Error, SaveBudgetInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveMonthlyBudget,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useDeactivateMonthlyBudget(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateMonthlyBudget,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
