import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PdfOcrAction } from '@/components/documents/pdf-ocr-action';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(cleanup);
it('requires explicit acknowledgement of original PDF processing before dispatch', () => {
  const run = vi.fn();
  render(<PdfOcrAction disabled={false} onExtract={run} />);
  expect(screen.getByText('optionalOcr')).toBeVisible();
  expect(screen.getByText('ocrDisclosure')).toBeVisible();
  expect(screen.getByRole('button', { name: 'extractOcr' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'extractOcr' }));
  expect(run).toHaveBeenCalledTimes(1);
});
