import { expect, it } from 'vitest';
import { reviewMetadataPatch } from '@/lib/transactions/existing-ai-review';
const snapshot = {
  type: 'expense',
  account_id: 'bank',
  description: 'Bank message',
  notes: 'Original note',
  category_id: 'old',
};
const proposal = { description: 'Lunch', notes: 'Lunch note', category_id: 'food' };
it('applies only selected metadata and preserves edits made after analysis started', () => {
  expect(
    reviewMetadataPatch(snapshot, { ...snapshot, notes: 'My newer note' }, proposal, [
      'description',
      'notes',
      'category_id',
    ]),
  ).toEqual({ description: 'Lunch', category_id: 'food' });
  expect(reviewMetadataPatch(snapshot, snapshot, proposal, ['notes'])).toEqual({
    notes: 'Lunch note',
  });
});
it('rejects stale financial context and never removes an existing category when AI is uncertain', () => {
  expect(
    reviewMetadataPatch(snapshot, { ...snapshot, type: 'income' }, proposal, ['category_id']),
  ).toEqual({});
  expect(
    reviewMetadataPatch(snapshot, snapshot, { ...proposal, category_id: null }, ['category_id']),
  ).toEqual({});
});
