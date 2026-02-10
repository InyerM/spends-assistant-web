import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountKeys } from '@/lib/api/queries/account.queries';
import type { Account, CreateAccountInput, UpdateAccountInput } from '@/types';

async function createAccount(input: CreateAccountInput): Promise<Account> {
  const res = await fetch('/api/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to create account');
  }
  return res.json() as Promise<Account>;
}

async function updateAccount({ id, ...input }: UpdateAccountInput): Promise<Account> {
  const res = await fetch(`/api/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to update account');
  }
  return res.json() as Promise<Account>;
}

export function useCreateAccount(): ReturnType<
  typeof useMutation<Account, Error, CreateAccountInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useUpdateAccount(): ReturnType<
  typeof useMutation<Account, Error, UpdateAccountInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
