import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DocumentCaptureCard } from '@/components/documents/document-capture-card';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(cleanup);
it('identifies a forwarded attachment and opens its original email directly', () => {
  render(
    <DocumentCaptureCard
      document={{
        id: 'doc',
        file_name: 'statement.pdf',
        status: 'uploaded',
        mime_type: 'application/pdf',
        document_type: null,
        created_at: '2026-10-05T12:00:00Z',
        updated_at: '2026-10-05T12:00:00Z',
        archived_at: null,
        source_inbox_item_id: 'mail-id',
        document_observations: [],
      }}
      history={[]}
      accounts={[]}
      categories={[]}
      busy={null}
      suggestionsBusy={false}
      onOpen={vi.fn()}
      onArchive={vi.fn()}
      onExtract={vi.fn()}
      onRestore={vi.fn()}
      onRefresh={vi.fn()}
    />,
  );
  expect(screen.getByText('sourceEmail')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'viewSourceEmail' })).toHaveAttribute(
    'href',
    '/inbox/mail-id',
  );
  expect(screen.getByText('pendingCapture')).toBeInTheDocument();
});
