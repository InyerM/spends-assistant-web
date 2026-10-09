import type { StoredDocument } from '@/lib/api/queries/document.queries';

export function documentNeedsReview(
  document: Pick<StoredDocument, 'status' | 'archived_at' | 'document_observations'>,
): boolean {
  return (
    !document.archived_at &&
    (['uploaded', 'processing', 'failed'].includes(document.status) ||
      document.document_observations.some((observation) => observation.status === 'pending'))
  );
}
