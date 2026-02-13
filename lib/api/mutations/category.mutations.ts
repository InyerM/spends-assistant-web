import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryKeys } from '@/lib/api/queries/category.queries';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@/types';

interface DeleteCategoryResult {
  success: boolean;
  unlinked_transactions: number;
}

interface CategoryWithCounts extends Category {
  transaction_count: number;
  children_count: number;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to create category');
  }
  return res.json() as Promise<Category>;
}

export async function updateCategory({ id, ...input }: UpdateCategoryInput): Promise<Category> {
  const res = await fetch(`/api/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to update category');
  }
  return res.json() as Promise<Category>;
}

export async function deleteCategory(id: string): Promise<DeleteCategoryResult> {
  const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to delete category');
  }
  return res.json() as Promise<DeleteCategoryResult>;
}

export async function fetchCategoryWithCounts(id: string): Promise<CategoryWithCounts> {
  const res = await fetch(`/api/categories/${id}?include_counts=true`);
  if (!res.ok) throw new Error('Failed to fetch category counts');
  return res.json() as Promise<CategoryWithCounts>;
}

export function useCreateCategory(): ReturnType<
  typeof useMutation<Category, Error, CreateCategoryInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpdateCategory(): ReturnType<
  typeof useMutation<Category, Error, UpdateCategoryInput>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useDeleteCategory(): ReturnType<
  typeof useMutation<DeleteCategoryResult, Error, string>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
