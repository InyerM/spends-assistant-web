import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useDocumentAvailability } from '@/hooks/use-document-availability';
vi.mock('@/lib/api/queries/planning.queries', () => ({
  usePlanning: () => ({ data: { preferences: {} } }),
}));
vi.mock('@/lib/api/queries/document.queries', () => ({
  useDocuments: () => ({ data: [{ id: 'existing' }] }),
}));
it('keeps documents available when there is document history', () => {
  expect(renderHook(useDocumentAvailability).result.current).toBe(true);
});
