import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlanningCommand } from '@/lib/planning';
export interface PlanningRequest {
  request_id: string;
  payload: PlanningCommand;
}
export function useSavePlanning(): ReturnType<typeof useMutation<unknown, Error, PlanningRequest>> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: PlanningRequest): Promise<unknown> => {
      const response = await fetch('/api/planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Planning could not be saved');
      return response.json() as Promise<unknown>;
    },
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['planning'] }),
        client.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
  });
}
