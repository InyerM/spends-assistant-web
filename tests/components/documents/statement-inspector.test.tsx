import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StatementInspector } from '@/components/documents/statement-inspector';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('suggests metadata after local PDF unlocking, clears the key and opens the original preview without posting financial data', async () => {
  const hints = {
    account_id: 'bank',
    last_four: '2651',
    period_start: '2026-09-01',
    period_end: '2026-09-30',
    cycle: 'monthly',
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ code: 'PDF_PASSWORD_REQUIRED' }, { status: 422 }))
    .mockResolvedValueOnce(Response.json({ hints }))
    .mockResolvedValueOnce(Response.json({ url: 'https://example.com/statement.pdf' }));
  vi.stubGlobal('fetch', fetch);
  const onHints = vi.fn();
  render(<StatementInspector documentId='doc' onHints={onHints} />);
  const key = await screen.findByLabelText('pdfPassword');
  fireEvent.change(key, { target: { value: 'example-key' } });
  fireEvent.click(screen.getByRole('button', { name: 'detect' }));
  await waitFor(() => expect(onHints).toHaveBeenCalledWith(hints));
  expect(screen.queryByDisplayValue('example-key')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'viewPdf' }));
  expect(await screen.findByTitle('pdfTitle')).toHaveAttribute(
    'src',
    'https://example.com/statement.pdf',
  );
  expect(fetch.mock.calls.every((call) => String(call[0]).endsWith('/inspect'))).toBe(true);
});
