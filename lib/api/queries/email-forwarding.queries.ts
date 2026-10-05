import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';

export type EmailForwardingRoute =
  | { status: 'unavailable' }
  | { status: 'unconfigured' }
  | {
      status: 'active';
      address: string;
      created_at: string;
      confirmation_received_at: string | null;
      verification_text: string | null;
      user_confirmed_at: string | null;
    };

export const emailForwardingKeys = {
  all: ['email-forwarding'] as const,
  route: (userId?: string | null) => ['email-forwarding', 'route', userId ?? null] as const,
};

export async function fetchEmailForwardingRoute(): Promise<EmailForwardingRoute> {
  const response = await fetch('/api/email-forwarding');
  if (!response.ok) throw new Error('Failed to load email forwarding route');
  return response.json() as Promise<EmailForwardingRoute>;
}

export function useEmailForwardingRoute(): ReturnType<typeof useQuery<EmailForwardingRoute>> {
  const userId = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: emailForwardingKeys.route(userId),
    queryFn: fetchEmailForwardingRoute,
    refetchInterval: (query) =>
      query.state.data?.status === 'active' && !query.state.data.confirmation_received_at
        ? 30_000
        : false,
  });
}
