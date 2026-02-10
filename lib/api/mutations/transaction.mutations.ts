import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import { accountKeys } from '@/lib/api/queries/account.queries';
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  BulkUpdateTransactionInput,
} from '@/types';

async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to create transaction');
  }
  return res.json() as Promise<Transaction>;
}

async function updateTransaction({ id, ...input }: UpdateTransactionInput): Promise<Transaction> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to update transaction');
  }
  return res.json() as Promise<Transaction>;
}

async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to delete transaction');
  }
}

export function useCreateTransaction(): ReturnType<
  typeof useMutation<Transaction, Error, CreateTransactionInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useUpdateTransaction(): ReturnType<
  typeof useMutation<Transaction, Error, UpdateTransactionInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTransaction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

async function bulkUpdateTransactions(input: BulkUpdateTransactionInput): Promise<Transaction[]> {
  const res = await fetch('/api/transactions/bulk', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to bulk update');
  }
  return res.json() as Promise<Transaction[]>;
}

export function useBulkUpdateTransactions(): ReturnType<
  typeof useMutation<Transaction[], Error, BulkUpdateTransactionInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkUpdateTransactions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useDeleteTransaction(): ReturnType<typeof useMutation<void, Error, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
