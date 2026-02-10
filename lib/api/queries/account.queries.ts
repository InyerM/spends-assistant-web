import { useQuery } from '@tanstack/react-query';
import type { Account } from '@/types';

export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  list: () => [...accountKeys.lists()] as const,
  details: () => [...accountKeys.all, 'detail'] as const,
  detail: (id: string) => [...accountKeys.details(), id] as const,
};

async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch('/api/accounts');
  if (!res.ok) throw new Error('Failed to fetch accounts');
  return res.json() as Promise<Account[]>;
}

async function fetchAccount(id: string): Promise<Account> {
  const res = await fetch(`/api/accounts/${id}`);
  if (!res.ok) throw new Error('Failed to fetch account');
  return res.json() as Promise<Account>;
}

export function useAccounts(): ReturnType<typeof useQuery<Account[]>> {
  return useQuery({
    queryKey: accountKeys.list(),
    queryFn: fetchAccounts,
  });
}

export function useAccount(id: string): ReturnType<typeof useQuery<Account>> {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => fetchAccount(id),
    enabled: !!id,
  });
}
