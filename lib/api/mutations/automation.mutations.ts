import { useMutation, useQueryClient } from '@tanstack/react-query';
import { automationKeys } from '@/lib/api/queries/automation.queries';
import type { AutomationRule, CreateAutomationRuleInput, UpdateAutomationRuleInput } from '@/types';

export async function createAutomationRule(
  input: CreateAutomationRuleInput,
): Promise<AutomationRule> {
  const res = await fetch('/api/automation-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to create automation rule');
  }
  return res.json() as Promise<AutomationRule>;
}

export async function updateAutomationRule({
  id,
  ...input
}: UpdateAutomationRuleInput): Promise<AutomationRule> {
  const res = await fetch(`/api/automation-rules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to update automation rule');
  }
  return res.json() as Promise<AutomationRule>;
}

export async function deleteAutomationRule(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/automation-rules/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to delete automation rule');
  }
  return res.json() as Promise<{ success: boolean }>;
}

export async function toggleAutomationRule({
  id,
  is_active,
}: {
  id: string;
  is_active: boolean;
}): Promise<AutomationRule> {
  const res = await fetch(`/api/automation-rules/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to toggle automation rule');
  }
  return res.json() as Promise<AutomationRule>;
}

export function useCreateAutomationRule(): ReturnType<
  typeof useMutation<AutomationRule, Error, CreateAutomationRuleInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAutomationRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export function useUpdateAutomationRule(): ReturnType<
  typeof useMutation<AutomationRule, Error, UpdateAutomationRuleInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAutomationRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export function useDeleteAutomationRule(): ReturnType<
  typeof useMutation<{ success: boolean }, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAutomationRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export function useToggleAutomationRule(): ReturnType<
  typeof useMutation<AutomationRule, Error, { id: string; is_active: boolean }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleAutomationRule,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}
