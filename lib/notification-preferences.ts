export const IN_APP_NOTIFICATION_GROUPS = ['email', 'budgets', 'goals', 'schedules'] as const;
export function inAppPreferences(
  value: unknown,
): Record<(typeof IN_APP_NOTIFICATION_GROUPS)[number], boolean> {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    email: record.email !== false,
    budgets: record.budgets !== false,
    goals: record.goals !== false,
    schedules: record.schedules !== false,
  };
}
