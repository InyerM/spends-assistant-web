import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import { accountKeys } from '@/lib/api/queries/account.queries';
import { usageKeys } from '@/hooks/use-usage';
import { budgetKeys } from '@/lib/api/queries/budget.queries';
import type { DuplicateReview, ImportDuplicate } from '@/types/import';
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

export class ReviewTransactionError extends Error {
  public constructor() {
    super('Review the transaction type, category, and destination');
    this.name = 'ReviewTransactionError';
  }
}

export class ReviewAutomationRuleError extends ReviewTransactionError {
  public constructor() {
    super();
    this.name = 'ReviewAutomationRuleError';
  }
}

export class ReplacementHasReviewLinksError extends Error {
  public constructor() {
    super('This transaction has active reviewed links');
    this.name = 'ReplacementHasReviewLinksError';
  }
}

async function transactionResponseError(response: Response): Promise<Error> {
  const body = (await response.json()) as { error?: string; code?: string };
  if (body.code === 'REVIEW_AUTOMATION_RULE') return new ReviewAutomationRuleError();
  if (body.code === 'REVIEW_TRANSACTION_FIELDS') return new ReviewTransactionError();
  if (body.code === 'REPLACEMENT_HAS_REVIEW_LINKS') return new ReplacementHasReviewLinksError();
  return new Error(body.error || 'Failed to create transaction');
}

// A failed attempt keeps its key across reconstructed payloads; success frees it for a new payment.
const requestKeys = new Map<string, string>();

function idempotencyKey(input: CreateTransactionInput, action: string): string {
  const fingerprint = JSON.stringify([action, input]);
  let key = requestKeys.get(fingerprint);
  if (!key) {
    key = crypto.randomUUID();
    requestKeys.set(fingerprint, key);
    if (requestKeys.size > 100) requestKeys.delete(requestKeys.keys().next().value!);
  }
  return key;
}

function finishAttempt(input: CreateTransactionInput, action: string): void {
  requestKeys.delete(JSON.stringify([action, input]));
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey(input, 'create'),
    },
    body: JSON.stringify(input),
  });

  if (res.status === 409) {
    const body = (await res.json()) as DuplicateConflict;
    throw new DuplicateError(body.match, input);
  }

  if (!res.ok) {
    throw await transactionResponseError(res);
  }
  const transaction = (await res.json()) as Transaction;
  finishAttempt(input, 'create');
  return transaction;
}

export async function forceCreateTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await fetch('/api/transactions?force=true', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey(input, 'force'),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw await transactionResponseError(res);
  }
  const transaction = (await res.json()) as Transaction;
  finishAttempt(input, 'force');
  return transaction;
}

export async function replaceTransaction(
  input: CreateTransactionInput,
  replaceId: string,
): Promise<Transaction> {
  const res = await fetch(`/api/transactions?replace=${replaceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey(input, `replace:${replaceId}`),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw await transactionResponseError(res);
  }
  const transaction = (await res.json()) as Transaction;
  finishAttempt(input, `replace:${replaceId}`);
  return transaction;
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
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
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
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
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
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export async function bulkDeleteTransactions(ids: string[]): Promise<{ deletedCount: number }> {
  const res = await fetch('/api/transactions/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to bulk delete');
  }
  return res.json() as Promise<{ deletedCount: number }>;
}

export function useBulkDeleteTransactions(): ReturnType<
  typeof useMutation<{ deletedCount: number }, Error, string[]>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkDeleteTransactions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
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
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
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
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

// --- Import-related mutations ---

export interface ImportTransactionsInput {
  transactions: {
    date: string;
    time: string;
    amount: number;
    description: string;
    notes: string | null;
    type: string;
    account: string;
    category: string | null;
    payment_method: string | null;
    source: string;
  }[];
  resolve_names: boolean;
  file_name: string;
  request_id: string;
  row_count: number;
  duplicate_reviews?: DuplicateReview[];
}

export interface ImportTransactionsResult {
  imported: number;
  skipped: number;
  errors: string[];
  import_id?: string | null;
}

/** Thrown when the server re-check finds matches that were not (or no longer) reviewed. */
export class ImportReviewRequiredError extends Error {
  public constructor(public readonly duplicates: DuplicateMatch[]) {
    super('Possible duplicates need review before importing');
    this.name = 'ImportReviewRequiredError';
  }
}

export async function importTransactions(
  input: ImportTransactionsInput,
): Promise<ImportTransactionsResult> {
  const res = await fetch('/api/transactions/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { duplicates?: DuplicateMatch[] };
    throw new ImportReviewRequiredError(body.duplicates ?? []);
  }
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Import failed');
  }
  return res.json() as Promise<ImportTransactionsResult>;
}

export function useImportTransactions(): ReturnType<
  typeof useMutation<ImportTransactionsResult, Error, ImportTransactionsInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importTransactions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: accountKeys.all });
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}

export interface UploadImportFileInput {
  file: File;
  import_id: string;
}

export async function uploadImportFile(input: UploadImportFileInput): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('import_id', input.import_id);
  const res = await fetch('/api/transactions/imports', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to upload import file');
  }
  return res.json();
}

export function useUploadImportFile(): ReturnType<
  typeof useMutation<unknown, Error, UploadImportFileInput>
> {
  return useMutation({ mutationFn: uploadImportFile });
}

export interface CheckDuplicatesInput {
  transactions: { date: string; amount: number; account: string }[];
}

export type DuplicateMatch = ImportDuplicate;

export interface CheckDuplicatesResult {
  duplicates: DuplicateMatch[];
  unresolved_accounts: string[];
}

export async function checkImportDuplicates(
  input: CheckDuplicatesInput,
): Promise<CheckDuplicatesResult> {
  const res = await fetch('/api/transactions/import/check-duplicates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error('Failed to check duplicates');
  }
  return res.json() as Promise<CheckDuplicatesResult>;
}

export function useCheckImportDuplicates(): ReturnType<
  typeof useMutation<CheckDuplicatesResult, Error, CheckDuplicatesInput>
> {
  return useMutation({ mutationFn: checkImportDuplicates });
}
