import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  emailForwardingKeys,
  type EmailForwardingRoute,
} from '@/lib/api/queries/email-forwarding.queries';

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  const result = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(result?.error ?? 'Email forwarding request failed');
}

export async function createEmailForwardingRoute(): Promise<EmailForwardingRoute> {
  return (
    await check(await fetch('/api/email-forwarding', { method: 'POST' }))
  ).json() as Promise<EmailForwardingRoute>;
}

export async function deleteEmailForwardingRoute(): Promise<void> {
  await check(await fetch('/api/email-forwarding', { method: 'DELETE' }));
}

export async function acknowledgeEmailForwardingVerification(): Promise<EmailForwardingRoute> {
  return (
    await check(await fetch('/api/email-forwarding', { method: 'PATCH' }))
  ).json() as Promise<EmailForwardingRoute>;
}

export function useAcknowledgeEmailForwardingVerification(): ReturnType<
  typeof useMutation<EmailForwardingRoute, Error, void>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeEmailForwardingVerification,
    onSuccess: (route) => queryClient.setQueryData(emailForwardingKeys.route(), route),
  });
}

export function useCreateEmailForwardingRoute(): ReturnType<
  typeof useMutation<EmailForwardingRoute, Error, void>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEmailForwardingRoute,
    onSuccess: (route) => {
      queryClient.setQueryData(emailForwardingKeys.route(), route);
    },
  });
}

export function useDeleteEmailForwardingRoute(): ReturnType<typeof useMutation<void, Error, void>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteEmailForwardingRoute,
    onSuccess: () => {
      queryClient.setQueryData(emailForwardingKeys.route(), { status: 'unconfigured' });
    },
  });
}
