import { useQuery } from '@tanstack/react-query';

export type EmailForwardingRoute =
  | { status: 'unavailable' }
  | { status: 'unconfigured' }
  | {
      status: 'active';
      address: string;
      created_at: string;
      confirmation_received_at: string | null;
      verification_text: string | null;
    };

export const emailForwardingKeys = {
  all: ['email-forwarding'] as const,
  route: () => ['email-forwarding', 'route'] as const,
};

export async function fetchEmailForwardingRoute(): Promise<EmailForwardingRoute> {
  const response = await fetch('/api/email-forwarding');
  if (!response.ok) throw new Error('Failed to load email forwarding route');
  return response.json() as Promise<EmailForwardingRoute>;
}

export function useEmailForwardingRoute(): ReturnType<typeof useQuery<EmailForwardingRoute>> {
  return useQuery({
    queryKey: emailForwardingKeys.route(),
    queryFn: fetchEmailForwardingRoute,
    refetchInterval: (query) =>
      query.state.data?.status === 'active' && !query.state.data.confirmation_received_at
        ? 30_000
        : false,
  });
}
