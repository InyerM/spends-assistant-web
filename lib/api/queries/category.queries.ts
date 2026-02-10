import { useQuery } from '@tanstack/react-query';
import type { Category, CategoryWithChildren } from '@/types';

export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: () => [...categoryKeys.lists()] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
};

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json() as Promise<Category[]>;
}

function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
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

export function useCategoryTree(): ReturnType<typeof useQuery<CategoryWithChildren[]>> {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: async () => {
      const categories = await fetchCategories();
      return buildCategoryTree(categories);
    },
  });
}
