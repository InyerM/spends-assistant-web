import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
}

export const sessionKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionKeys.all, 'list'] as const,
};

async function fetchSessions(): Promise<UserSession[]> {
  const res = await fetch('/api/settings/sessions');
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json() as Promise<UserSession[]>;
}

async function revokeSession(id: string): Promise<void> {
  const res = await fetch(`/api/settings/sessions?id=${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to revoke session');
  }
}

export function useSessions(): ReturnType<typeof useQuery<UserSession[]>> {
  return useQuery({
    queryKey: sessionKeys.list(),
    queryFn: fetchSessions,
  });
}

export function useRevokeSession(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}
