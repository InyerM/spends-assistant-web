import type { Category } from '@/types/category';

const excludedCategorySlugs = new Set(['investments', 'loans']);

export function budgetCategoryOptions(categories: Category[]): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return categories.filter((category) => {
    if (category.type !== 'expense' || !category.is_active) return false;

    const visited = new Set<string>();
    let current: Category | undefined = category;
    while (current) {
      if (visited.has(current.id)) return false;
      visited.add(current.id);
      if (excludedCategorySlugs.has(current.slug)) return false;
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return true;
  });
}

export function budgetProgress(spent: number, limit: number): number {
  if (!Number.isFinite(spent) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.min(100, Math.max(0, (spent / limit) * 100));
}

export function currentBudgetMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function shiftBudgetMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
