import { expect, it } from 'vitest';
import { savedDashboardLayouts, saveDashboardLayout } from '@/lib/saved-dashboard-layouts';
it('saves sanitized independent named layouts and updates a layout with the same name', () => {
  const rows = [{ id: 'summary', zone: 'overview', width: 12, height: 2 }] as const;
  const first = saveDashboardLayout([], ' Weekly ', [...rows]);
  expect(first[0].name).toBe('Weekly');
  expect(first[0].items).toEqual(rows);
  const second = saveDashboardLayout(first, 'Weekly', [
    { id: 'recent', zone: 'activity', width: 6, height: 4 },
  ]);
  expect(second).toHaveLength(1);
  expect(second[0].items[0].id).toBe('recent');
  expect(first[0].items[0].id).toBe('summary');
  expect(savedDashboardLayouts([{ name: 'unsafe', items: [{ id: 'unknown' }] }])).toEqual([]);
});
it('bounds saved layouts and rejects blank names', () => {
  let saved = savedDashboardLayouts(undefined);
  for (let i = 0; i < 7; i++)
    saved = saveDashboardLayout(saved, `Layout ${i}`, [
      { id: 'summary', zone: 'overview', width: 12, height: 2 },
    ]);
  expect(saved).toHaveLength(5);
  expect(saveDashboardLayout(saved, ' ', [])).toEqual(saved);
});
