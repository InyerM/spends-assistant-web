import { describe, expect, it } from 'vitest';
import {
  budgetCategoryOptions,
  budgetProgress,
  currentBudgetMonth,
  shiftBudgetMonth,
} from '@/lib/budgets';
import type { Category } from '@/types/category';

function category(
  id: string,
  slug: string,
  parentId: string | null = null,
  type: Category['type'] = 'expense',
): Category {
  return {
    id,
    user_id: 'owner',
    name: slug,
    slug,
    type,
    parent_id: parentId,
    icon: null,
    color: null,
    is_active: true,
    created_at: '2026-01-01',
  };
}

describe('budget presentation rules', () => {
  it('excludes principal and investment category descendants without hiding other expenses', () => {
    const categories = [
      category('food', 'food'),
      category('dining', 'dining', 'food'),
      category('investments', 'investments'),
      category('stocks', 'stocks', 'investments'),
      category('finance', 'financial-expenses'),
      category('loans', 'loans', 'finance'),
      category('loan-child', 'loan-child', 'loans'),
      category('salary', 'salary', null, 'income'),
      { ...category('hidden', 'hidden'), is_active: false },
    ];
    expect(budgetCategoryOptions(categories).map(({ id }) => id)).toEqual([
      'food',
      'dining',
      'finance',
    ]);
  });

  it('keeps progress width bounded and month changes on calendar boundaries', () => {
    expect(budgetProgress(300, 500)).toBe(60);
    expect(budgetProgress(600, 500)).toBe(100);
    expect(shiftBudgetMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftBudgetMonth('2026-01-01', -1)).toBe('2025-12-01');
    expect(currentBudgetMonth(new Date(2026, 9, 8))).toBe('2026-10-01');
  });
});
