import { useQuery } from '@tanstack/react-query';

export interface UsageData {
  month: string;
  ai_parses_used: number;
  ai_parses_limit: number;
  transactions_count: number;
  transactions_limit: number;
  accounts_count: number;
  accounts_limit: number;
  categories_count: number;
  categories_limit: number;
  automations_count: number;
  automations_limit: number;
}

export const usageKeys = {
  all: ['usage'] as const,
  current: () => [...usageKeys.all, 'current'] as const,
};

async function fetchUsage(): Promise<UsageData> {
  const res = await fetch('/api/settings/usage');
  if (!res.ok) throw new Error('Failed to fetch usage');
  return res.json() as Promise<UsageData>;
}

export function useUsage(): ReturnType<typeof useQuery<UsageData>> {
  return useQuery({
    queryKey: usageKeys.current(),
    queryFn: fetchUsage,
  });
}
