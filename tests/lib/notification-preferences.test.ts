import { expect, it } from 'vitest';
import { inAppPreferences } from '@/lib/notification-preferences';
it('defaults to enabled and only respects explicit disabled booleans', () => {
  expect(inAppPreferences(undefined)).toEqual({
    email: true,
    budgets: true,
    goals: true,
    schedules: true,
  });
  expect(inAppPreferences({ email: false, budgets: 'false' })).toEqual({
    email: false,
    budgets: true,
    goals: true,
    schedules: true,
  });
});
