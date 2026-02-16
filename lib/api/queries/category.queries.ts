import { useQuery } from '@tanstack/react-query';
import type { Category, CategoryWithChildren } from '@/types';

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: () => [...categoryKeys.lists()] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
  allIncludingHidden: () => [...categoryKeys.all, 'all-including-hidden'] as const,
  treeAll: () => [...categoryKeys.all, 'tree-all'] as const,
};

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json() as Promise<Category[]>;
}

export async function fetchAllCategories(): Promise<Category[]> {
  const res = await fetch('/api/categories?include_hidden=true');
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json() as Promise<Category[]>;
}

export function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const parentCategories = categories.filter((c) => !c.parent_id);
  return parentCategories.map((parent) => ({
    ...parent,
    children: categories.filter((c) => c.parent_id === parent.id),
  }));
}

export function useCategories(): ReturnType<typeof useQuery<Category[]>> {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: fetchCategories,
  });
}

export function useAllCategories(): ReturnType<typeof useQuery<Category[]>> {
  return useQuery({
    queryKey: categoryKeys.allIncludingHidden(),
    queryFn: fetchAllCategories,
  });
}

export function useCategoryTree(): ReturnType<typeof useQuery<CategoryWithChildren[]>> {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: async () => {
      const categories = await fetchCategories();
      return buildCategoryTree(categories);
    },
  });
}

export function useAllCategoryTree(): ReturnType<typeof useQuery<CategoryWithChildren[]>> {
  return useQuery({
    queryKey: categoryKeys.treeAll(),
    queryFn: async () => {
      const categories = await fetchAllCategories();
      return buildCategoryTree(categories);
    },
  });
}
