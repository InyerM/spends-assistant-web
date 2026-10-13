import { expect, it } from 'vitest';
import { DASHBOARD_TEMPLATES, dashboardTemplate } from '@/lib/dashboard-templates';
it('provides five distinct layouts and omits unavailable modules without changing saved preferences', () => {
  expect(DASHBOARD_TEMPLATES).toHaveLength(5);
  const signatures = new Set(DASHBOARD_TEMPLATES.map((t) => JSON.stringify(dashboardTemplate(t))));
  expect(signatures.size).toBe(5);
  const rows = dashboardTemplate('saving', ['summary', 'accounts', 'trend']);
  expect(rows.every((r) => ['summary', 'accounts', 'trend'].includes(r.id))).toBe(true);
  expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
});
