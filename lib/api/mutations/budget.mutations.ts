import { useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetKeys } from '@/lib/api/queries/budget.queries';

export interface SaveBudgetInput {
  budget_id?: string;
  month: string;
  category_id: string;
  limit_cop: number;
  repeat_monthly?: boolean;
}

export async function saveMonthlyBudget(input: SaveBudgetInput): Promise<string> {
  const response = await fetch('/api/budgets', {
    method: input.budget_id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok)
    throw new Error(response.status === 409 ? 'budget_collision' : 'Could not save monthly budget');
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function deactivateMonthlyBudget(
  input: string | { budget_id: string; month: string },
): Promise<void> {
  const response = await fetch('/api/budgets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(typeof input === 'string' ? { budget_id: input } : input),
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

export function useDeactivateMonthlyBudget(): ReturnType<
  typeof useMutation<void, Error, string | { budget_id: string; month: string }>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateMonthlyBudget,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
