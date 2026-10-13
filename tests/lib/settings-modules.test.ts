import { expect, it } from 'vitest';
import { SETTINGS_MODULE_GROUPS } from '@/lib/settings-modules';
it('keeps configuration and optional setup reachable through grouped rows', () => {
  const rows = SETTINGS_MODULE_GROUPS.flatMap<{ id: string; href: string }>((group) => group.rows);
  expect(rows.some((row) => row.href === '/categories')).toBe(true);
  expect(rows.some((row) => row.href === '/automation')).toBe(true);
  expect(rows.some((row) => row.href === '/settings?tab=documents')).toBe(true);
  expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
});
