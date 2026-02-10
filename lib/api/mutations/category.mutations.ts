import { useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryKeys } from '@/lib/api/queries/category.queries';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@/types';

async function createCategory(input: CreateCategoryInput): Promise<Category> {
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

async function updateCategory({ id, ...input }: UpdateCategoryInput): Promise<Category> {
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
