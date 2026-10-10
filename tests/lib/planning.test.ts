import { expect, it } from 'vitest';
import { dashboardWidgets, moveWidget, reorderWidget, planningCommand } from '@/lib/planning';
it('keeps dashboard controls bounded and rejects invalid money or schedule consent', () => {
  expect(dashboardWidgets(['recent', 'recent', 'invalid', 'goals'])).toEqual(['recent', 'goals']);
  expect(moveWidget(['recent', 'goals'], 1, -1)).toEqual(['goals', 'recent']);
  expect(
    planningCommand.safeParse({
      action: 'save_goal',
      id: crypto.randomUUID(),
      name: 'Trip',
      currency: 'COP',
      target_amount: 100,
      saved_amount: -1,
      due_date: null,
    }).success,
  ).toBe(false);
});

it('reorders a dragged widget without losing other widgets or accepting foreign identifiers', () => {
  expect(reorderWidget(['recent', 'goals', 'budgets'], 'budgets', 'recent')).toEqual([
    'budgets',
    'recent',
    'goals',
  ]);
  expect(reorderWidget(['recent', 'goals'], 'unknown', 'recent')).toEqual(['recent', 'goals']);
});
