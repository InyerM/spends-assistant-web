import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
import { StatementEvidenceLink } from '@/components/transactions/statement-evidence-link';
it('shows an accessible reconciled link to the actual source statement', () => {
  render(
    <StatementEvidenceLink
      proof={{
        transaction_id: 'tx',
        observation_id: 'row',
        document_id: 'doc',
        file_name: 'Statement.pdf',
        valid: true,
      }}
    />,
  );
  expect(screen.getByRole('link', { name: 'viewStatementEvidence' })).toHaveAttribute(
    'href',
    '/documents#document-doc',
  );
});
