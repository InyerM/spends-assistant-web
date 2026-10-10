import { z } from 'zod';
const money = z
  .number()
  .min(0)
  .max(9_999_999_999_999.99)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.001);
const identity = { id: z.uuid(), name: z.string().trim().min(1).max(100) };
const expense = {
  ...identity,
  amount: money.refine((n) => n > 0),
  account_id: z.uuid(),
  category_id: z.uuid().nullable(),
};
export const planningCommand = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('save_goal'),
      ...identity,
      currency: z.enum(['COP', 'USD']),
      target_amount: money.refine((n) => n > 0),
      saved_amount: money,
      due_date: z.iso.date().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal('save_schedule'),
      ...expense,
      cadence: z.enum(['monthly', 'days']),
      interval_days: z.number().int().min(1).max(366),
      next_due: z.iso.date(),
      due_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      timezone: z.string().max(80),
      automatic: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('save_common'), ...expense }).strict(),
  z
    .object({
      action: z.enum(['archive_goal', 'archive_schedule', 'archive_common']),
      id: z.uuid(),
    })
    .strict(),
  z
    .object({ action: z.literal('preferences'), preferences: z.record(z.string(), z.unknown()) })
    .strict(),
]);
export type PlanningCommand = z.infer<typeof planningCommand>;
export interface SavingsGoal {
  id: string;
  name: string;
  currency: string;
  target_amount: number;
  saved_amount: number;
  due_date: string | null;
  is_active: boolean;
}
export interface PlannedExpense {
  id: string;
  name: string;
  amount: number;
  account_id: string;
  category_id: string | null;
  cadence: 'monthly' | 'days';
  interval_days: number;
  month_day: number;
  next_due: string;
  due_time: string;
  timezone: string;
  automatic: boolean;
  is_active: boolean;
  last_error: string | null;
}
export interface CommonExpense {
  id: string;
  name: string;
  amount: number;
  account_id: string;
  category_id: string | null;
  is_active: boolean;
}
export interface PlanningSnapshot {
  goals: SavingsGoal[];
  schedules: PlannedExpense[];
  common: CommonExpense[];
  preferences: Record<string, unknown>;
}
export const DASHBOARD_WIDGETS = [
  'accounts',
  'trend',
  'categories',
  'nature',
  'recent',
  'budgets',
  'goals',
  'custom',
] as const;
export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];
export function dashboardWidgets(value: unknown): DashboardWidget[] {
  if (!Array.isArray(value)) return [...DASHBOARD_WIDGETS];
  return [
    ...new Set(
      value.filter(
        (id): id is DashboardWidget =>
          typeof id === 'string' && DASHBOARD_WIDGETS.some((w) => w === id),
      ),
    ),
  ];
}
export function moveWidget(
  widgets: DashboardWidget[],
  index: number,
  direction: -1 | 1,
): DashboardWidget[] {
  const result = [...widgets];
  const target = index + direction;
  if (target < 0 || target >= result.length) return result;
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
