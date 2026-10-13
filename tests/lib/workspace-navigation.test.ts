import { expect, it } from 'vitest';
import { documentModuleEnabled, workspacePathActive } from '@/lib/workspace-navigation';
it('keeps existing document users enabled and treats all intake routes as the review workspace', () => {
  expect(documentModuleEnabled({}, 0)).toBe(false);
  expect(documentModuleEnabled({ documents_enabled: true }, 0)).toBe(true);
  expect(documentModuleEnabled({}, 1)).toBe(true);
  expect(workspacePathActive('/transactions/shortcut-inbox', '/inbox')).toBe(true);
  expect(workspacePathActive('/transactions/shortcut-inbox', '/transactions')).toBe(false);
  expect(workspacePathActive('/transactions/123', '/transactions')).toBe(true);
});
