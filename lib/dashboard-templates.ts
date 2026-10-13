import { DASHBOARD_WIDGETS, type DashboardWidget } from '@/lib/planning';
import { WIDGET_ZONES, type WidgetPlacement } from '@/lib/dashboard-layout';
export const DASHBOARD_TEMPLATES = [
  'balanced',
  'spending',
  'saving',
  'activity',
  'detail',
] as const;
export type DashboardTemplate = (typeof DASHBOARD_TEMPLATES)[number];
const selections: Record<DashboardTemplate, DashboardWidget[]> = {
  balanced: ['summary', 'accounts', 'trend', 'recent', 'categories', 'budgets', 'goals'],
  spending: ['summary', 'nature', 'categories', 'recent', 'contacts', 'budgets'],
  saving: ['summary', 'accounts', 'trend', 'alerts', 'goals', 'budgets'],
  activity: ['summary', 'accounts', 'alerts', 'recent', 'contacts', 'categories'],
  detail: [
    'summary',
    'accounts',
    'trend',
    'nature',
    'recent',
    'categories',
    'contacts',
    'custom',
    'budgets',
    'goals',
    'usage',
  ],
};
export function dashboardTemplate(
  template: DashboardTemplate,
  available: readonly DashboardWidget[] = DASHBOARD_WIDGETS,
): WidgetPlacement[] {
  return selections[template]
    .filter((id) => available.includes(id))
    .map((id) => ({
      id,
      zone: WIDGET_ZONES[id],
      width:
        template === 'detail' ||
        ['summary', 'accounts', 'nature'].includes(id) ||
        (template === 'balanced' && id === 'trend') ||
        (template === 'activity' && id === 'alerts')
          ? 12
          : template === 'saving' && id === 'trend'
            ? 8
            : template === 'saving' && id === 'alerts'
              ? 4
              : 6,
      height: 4,
    }));
}
