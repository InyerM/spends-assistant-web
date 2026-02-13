import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import { accountKeys } from '@/lib/api/queries/account.queries';
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  BulkUpdateTransactionInput,
} from '@/types';

export interface DuplicateConflict {
  duplicate: true;
  match: Transaction;
}

export class DuplicateError extends Error {
  public match: Transaction;
  public input: CreateTransactionInput;

  public constructor(match: Transaction, input: CreateTransactionInput) {
    super('Duplicate transaction detected');
    this.match = match;
    this.input = input;
  }
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (res.status === 409) {
    const body = (await res.json()) as DuplicateConflict;
    throw new DuplicateError(body.match, input);
  }

  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to create transaction');
  }
  return res.json() as Promise<Transaction>;
}

export async function forceCreateTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/transactions?force=true', {
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

export async function replaceTransaction(
  input: CreateTransactionInput,
  replaceId: string,
): Promise<Transaction> {
  const res = await fetch(`/api/transactions?replace=${replaceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to replace transaction');
  }
  return res.json() as Promise<Transaction>;
}

export async function updateTransaction({
  id,
  ...input
}: UpdateTransactionInput): Promise<Transaction> {
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

export async function deleteTransaction(id: string): Promise<void> {
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

export async function bulkUpdateTransactions(
  input: BulkUpdateTransactionInput,
): Promise<Transaction[]> {
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

export async function resolveDuplicate(id: string, action: 'keep' | 'delete'): Promise<void> {
  if (action === 'keep') {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duplicate_status: 'confirmed' }),
    });
    if (!res.ok) throw new Error('Failed to resolve duplicate');
  } else {
    await deleteTransaction(id);
  }
}

export function useResolveDuplicate(): ReturnType<
  typeof useMutation<void, Error, { id: string; action: 'keep' | 'delete' }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }) => resolveDuplicate(id, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
