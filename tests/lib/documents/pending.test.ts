import { expect, it } from 'vitest';
import { documentNeedsReview } from '@/lib/documents/pending';
it('counts unprocessed captures and unresolved observations, excluding archived and resolved evidence', () => {
  expect(
    documentNeedsReview({ status: 'uploaded', archived_at: null, document_observations: [] }),
  ).toBe(true);
  expect(
    documentNeedsReview({
      status: 'extracted',
      archived_at: null,
      document_observations: [{ status: 'pending' }] as never,
    }),
  ).toBe(true);
  expect(
    documentNeedsReview({
      status: 'extracted',
      archived_at: null,
      document_observations: [{ status: 'accepted' }] as never,
    }),
  ).toBe(false);
  expect(
    documentNeedsReview({ status: 'failed', archived_at: '2026-10-09', document_observations: [] }),
  ).toBe(false);
});
