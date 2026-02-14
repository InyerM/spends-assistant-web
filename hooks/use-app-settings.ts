import { useQuery } from '@tanstack/react-query';

export interface AppSettings {
  free_ai_parses_limit: number;
  free_transactions_limit: number;
  free_accounts_limit: number;
  free_automations_limit: number;
  free_categories_limit: number;
}

const DEFAULTS: AppSettings = {
  free_ai_parses_limit: 15,
  free_transactions_limit: 50,
  free_accounts_limit: 4,
  free_automations_limit: 5,
  free_categories_limit: 15,
};

async function fetchAppSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings/app');
  if (!res.ok) return DEFAULTS;
  const data = (await res.json()) as Record<string, number>;
  return { ...DEFAULTS, ...data };
}

export function useAppSettings(): ReturnType<typeof useQuery<AppSettings>> {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: fetchAppSettings,
    staleTime: 1000 * 60 * 30, // 30 minutes — these rarely change
  });
}
