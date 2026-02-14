import { useQuery } from '@tanstack/react-query';

export interface Subscription {
  id?: string;
  user_id?: string;
  plan: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due';
  current_period_start: string | null;
  current_period_end: string | null;
  created_at?: string;
  updated_at?: string;
}

export const subscriptionKeys = {
  all: ['subscription'] as const,
  detail: () => [...subscriptionKeys.all, 'detail'] as const,
};

async function fetchSubscription(): Promise<Subscription> {
  const res = await fetch('/api/settings/subscription');
  if (!res.ok) throw new Error('Failed to fetch subscription');
  return res.json() as Promise<Subscription>;
}

export function useSubscription(): ReturnType<typeof useQuery<Subscription>> {
  return useQuery({
    queryKey: subscriptionKeys.detail(),
    queryFn: fetchSubscription,
  });
}
