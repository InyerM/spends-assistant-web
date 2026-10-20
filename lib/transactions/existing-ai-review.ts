export type ReviewMetadataField = 'description' | 'notes' | 'category_id';
export interface ReviewMetadataSnapshot {
  type: string;
  account_id: string;
  description: string;
  notes: string;
  category_id?: string | null;
}
export type ReviewMetadataPatch = Partial<Record<ReviewMetadataField, string>>;
export function reviewMetadataPatch(
  snapshot: ReviewMetadataSnapshot,
  current: ReviewMetadataSnapshot,
  proposal: { description: string; notes: string; category_id: string | null },
  selected: ReviewMetadataField[],
): ReviewMetadataPatch {
  if (snapshot.type !== current.type || snapshot.account_id !== current.account_id) return {};
  const patch: ReviewMetadataPatch = {};
  for (const field of selected) {
    const value = proposal[field];
    if (
      value !== null &&
      value !== snapshot[field] &&
      (current[field] ?? '') === (snapshot[field] ?? '')
    )
      patch[field] = value;
  }
  return patch;
}
