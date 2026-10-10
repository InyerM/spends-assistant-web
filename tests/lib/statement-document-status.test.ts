import { expect, it } from 'vitest';
import { withStatementProofs } from '@/lib/statement-document-status';
it('marks only currently valid statement rows as reconciled without mutating source rows', () => {
  const row = { id: 'row', status: 'pending' };
  const doc = { id: 'doc', document_type: 'statement', document_observations: [row] };
  const proof = { document_id: 'doc', observation_id: 'row', transaction_id: 'tx', valid: true };
  expect(withStatementProofs(doc, [proof]).document_observations[0].status).toBe('reconciled');
  expect(
    withStatementProofs(doc, [{ ...proof, valid: false }]).document_observations[0].status,
  ).toBe('pending');
  expect(row.status).toBe('pending');
});
