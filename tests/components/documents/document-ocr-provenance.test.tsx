import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DocumentOcrProvenance } from '@/components/documents/document-ocr-provenance';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { page?: number }) =>
    values?.page ? `${key} ${values.page}` : key,
}));
afterEach(cleanup);
it('shows each draft original page and review disclosure', () => {
  render(
    <DocumentOcrProvenance
      rows={[
        {
          id: 'row',
          source_page: 2,
          description: 'Synthetic purchase',
          source_excerpt: 'Synthetic purchase 12',
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByText('ocrProvenance'));
  expect(screen.getByText(/sourcePage 2/)).toBeInTheDocument();
  expect(screen.getByText('Synthetic purchase 12')).toBeInTheDocument();
  expect(screen.getByText('ocrReviewRequired')).toBeInTheDocument();
});
