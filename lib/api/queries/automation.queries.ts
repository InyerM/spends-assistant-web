import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import type { AutomationRule, AutomationRuleFilters } from '@/types';

export const automationKeys = {
  all: ['automation-rules'] as const,
  lists: () => [...automationKeys.all, 'list'] as const,
  list: (filters?: AutomationRuleFilters) => [...automationKeys.lists(), filters] as const,
  infinite: (filters?: Omit<AutomationRuleFilters, 'page' | 'limit'>) =>
    [...automationKeys.all, 'infinite', filters] as const,
};

interface AutomationRulesResult {
  data: AutomationRule[];
  count: number;
  page: number;
}

const PAGE_SIZE = 20;

export async function fetchAutomationRules(
  filters: AutomationRuleFilters = {},
): Promise<AutomationRulesResult> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.rule_type) params.set('rule_type', filters.rule_type);
  if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));

  const res = await fetch(`/api/automation-rules?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch automation rules');
  return res.json() as Promise<AutomationRulesResult>;
}

export function useAutomationRules(
  filters: AutomationRuleFilters = {},
): ReturnType<typeof useQuery<AutomationRulesResult>> {
  return useQuery({
    queryKey: automationKeys.list(filters),
    queryFn: () => fetchAutomationRules(filters),
  });
}

export function useInfiniteAutomationRules(
  filters: Omit<AutomationRuleFilters, 'page' | 'limit'> = {},
): ReturnType<
  typeof useInfiniteQuery<
    AutomationRulesResult,
    Error,
    { pages: AutomationRulesResult[] },
    readonly unknown[],
    number
  >
> {
  return useInfiniteQuery({
    queryKey: automationKeys.infinite(filters),
    queryFn: async ({ pageParam }): Promise<AutomationRulesResult> => {
      const result = await fetchAutomationRules({
        ...filters,
        page: pageParam,
        limit: PAGE_SIZE,
      });
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage): number | undefined => {
      if (lastPage.data.length < PAGE_SIZE) return undefined;
      return lastPage.page + 1;
    },
  });
}
