import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeyKeys } from '@/lib/api/queries/api-key.queries';
import type { ApiKey } from '@/lib/api/queries/api-key.queries';

export interface NewKeyResponse extends ApiKey {
  key: string;
}

export async function createApiKey(name: string): Promise<NewKeyResponse> {
  const res = await fetch('/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || 'Default' }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to create API key');
  }
  return res.json() as Promise<NewKeyResponse>;
}

export async function deleteApiKey(id: string): Promise<void> {
  const res = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to delete API key');
  }
}

export function useCreateApiKey(): ReturnType<typeof useMutation<NewKeyResponse, Error, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
}

export function useDeleteApiKey(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
}
