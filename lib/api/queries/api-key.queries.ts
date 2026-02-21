import { useQuery } from '@tanstack/react-query';

export interface ApiKey {
  id: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const,
  list: () => [...apiKeyKeys.lists()] as const,
};

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await fetch('/api/api-keys');
  if (!res.ok) throw new Error('Failed to fetch API keys');
  return res.json() as Promise<ApiKey[]>;
}

export function useApiKeys(): ReturnType<typeof useQuery<ApiKey[]>> {
  return useQuery({
    queryKey: apiKeyKeys.list(),
    queryFn: fetchApiKeys,
  });
}
