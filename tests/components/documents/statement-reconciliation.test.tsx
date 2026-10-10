import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StatementReconciliation } from '@/components/documents/statement-reconciliation';
const invalidate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('next-intl', () => ({
  useLocale: () => 'es',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate }),
  useQuery: () => ({
    isPending: false,
    isError: false,
    data: {
      scope: { account_id: 'bank', period_start: '2026-09-01', period_end: '2026-09-30' },
      rows: [
        {
          id: 'row',
          amount: -100,
          currency: 'COP',
          occurred_at_text: '2026-09-11',
          status: 'pending',
          description: 'Statement lunch',
        },
        {
          id: 'unknown',
          amount: null,
          currency: 'COP',
          occurred_at_text: null,
          status: 'pending',
          description: 'Unknown row',
        },
      ],
      transactions: [
        {
          id: 'tx',
          account_id: 'bank',
          transfer_to_account_id: null,
          amount: 100,
          currency: 'COP',
          date: '2026-09-11',
          type: 'expense',
          description: 'App lunch',
        },
        {
          id: 'extra',
          account_id: 'bank',
          transfer_to_account_id: null,
          amount: 40,
          currency: 'COP',
          date: '2026-09-12',
          type: 'expense',
          description: 'App only',
        },
      ],
      proofs: [],
    },
  }),
}));
vi.mock('@/components/transactions/period-selector', () => ({
  PeriodSelector: () => <div>period</div>,
}));
vi.mock('@/components/documents/document-review-selects', () => ({
  DocumentAccountSelect: () => <div>account</div>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('shows both differences, blocks incomplete evidence and confirms only the selected link', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ success: true }));
  vi.stubGlobal('fetch', fetch);
  render(<StatementReconciliation documentId='doc' accounts={[]} />);
  expect(screen.getByText('Statement lunch')).toBeInTheDocument();
  expect(screen.getByText('App only')).toBeInTheDocument();
  expect(screen.getByText('needsFields')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /App only/ })).toHaveAttribute(
    'href',
    '/transactions/extra',
  );
  fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({
    action: 'confirm',
    observation_id: 'row',
    transaction_id: 'tx',
  });
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions'] }));
  expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
});
