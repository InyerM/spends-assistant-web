import { useQuery } from '@tanstack/react-query';
import type { AutomationRule } from '@/types';

export const automationKeys = {
  all: ['automation-rules'] as const,
  lists: () => [...automationKeys.all, 'list'] as const,
  list: () => [...automationKeys.lists()] as const,
};

async function fetchAutomationRules(): Promise<AutomationRule[]> {
  const res = await fetch('/api/automation-rules');
  if (!res.ok) throw new Error('Failed to fetch automation rules');
  return res.json() as Promise<AutomationRule[]>;
}

export function useAutomationRules(): ReturnType<typeof useQuery<AutomationRule[]>> {
  return useQuery({
    queryKey: automationKeys.list(),
    queryFn: fetchAutomationRules,
  });
}
