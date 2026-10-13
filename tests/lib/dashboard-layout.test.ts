import { expect, it } from 'vitest';
import { dashboardLayout, placeWidget, resizeWidget } from '@/lib/dashboard-layout';
it('migrates legacy order, sanitizes dimensions and moves widgets between zones without duplication', () => {
  const legacy = dashboardLayout(undefined, ['recent', 'accounts']);
  expect(legacy.map((x) => x.id)).toEqual(['summary', 'recent', 'accounts', 'usage']);
  const moved = placeWidget(legacy, 'recent', 'planning');
  expect(moved.find((x) => x.id === 'recent')?.zone).toBe('planning');
  expect(moved).toHaveLength(4);
  expect(resizeWidget(moved, 'recent', 99, -2).find((x) => x.id === 'recent')).toMatchObject({
    width: 12,
    height: 2,
  });
  expect(
    dashboardLayout(
      [
        { id: 'invalid' },
        { id: 'recent', zone: 'unknown', width: 1, height: 999 },
        { id: 'recent', zone: 'planning', width: 12, height: 4 },
      ],
      [],
    ),
  ).toEqual([{ id: 'recent', zone: 'activity', width: 4, height: 8 }]);
  expect(dashboardLayout([], ['accounts'])).toEqual([]);
});
it('packs natural content heights into grid rows without clipping', async () => {
  const { widgetRowSpan } = await import('@/lib/dashboard-layout');
  expect(widgetRowSpan(160)).toBe(8);
  expect(widgetRowSpan(484)).toBe(21);
  for (const height of [1, 160, 321, 484]) {
    const rows = widgetRowSpan(height);
    expect(rows * 24 - 16).toBeGreaterThanOrEqual(height);
    expect(rows * 24 - 16 - height).toBeLessThan(24);
  }
});
