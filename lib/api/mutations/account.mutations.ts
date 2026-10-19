import { useMutation, useQueryClient } from '@tanstack/react-query';
import { automationKeys } from '@/lib/api/queries/automation.queries';
import { accountKeys } from '@/lib/api/queries/account.queries';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import { usageKeys } from '@/hooks/use-usage';
import type { Account, CreateAccountInput, UpdateAccountInput } from '@/types';

export async function createAccount(input: CreateAccountInput): Promise<Account> {
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

export async function updateAccount({ id, ...input }: UpdateAccountInput): Promise<Account> {
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
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
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
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
    },
  });
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to delete account');
  }
}

export function useDeleteAccount(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: automationKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
    },
  });
}

export interface BalanceAdjustmentInput {
  id: string;
  request_id: string;
  target: number;
  mode: 'manual' | 'transaction';
}
export async function setAccountBalance({ id, ...input }: BalanceAdjustmentInput): Promise<void> {
  const response = await fetch(`/api/accounts/${id}/balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = (await response.json()) as { error?: string };
    throw new Error(error.error ?? 'Failed to adjust balance');
  }
}
export function useSetAccountBalance(): ReturnType<
  typeof useMutation<void, Error, BalanceAdjustmentInput>
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setAccountBalance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
    },
  });
}

export function useEnableAccountCurrency(): ReturnType<
  typeof useMutation<Account, Error, { id: string; currency: string }>
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currency }) => {
      const response = await fetch(`/api/accounts/${id}/currencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      });
      if (!response.ok) throw new Error('Account currency could not be enabled');
      return response.json() as Promise<Account>;
    },
    onSuccess: async () => {
      await Promise.all(
        ['accounts', 'documents', 'usage'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
