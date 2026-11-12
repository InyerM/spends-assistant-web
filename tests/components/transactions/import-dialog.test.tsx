import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportDialog } from '@/components/transactions/import-dialog';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/hooks/use-usage', () => ({ useUsage: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-subscription', () => ({ useSubscription: () => ({ data: { plan: 'pro' } }) }));
vi.mock('@/lib/api/mutations/transaction.mutations', () => ({
  useImportTransactions: () => ({ mutateAsync: vi.fn() }),
  useUploadImportFile: () => ({ mutateAsync: vi.fn() }),
  useCheckImportDuplicates: () => ({ isPending: false, reset: vi.fn(), mutateAsync: vi.fn() }),
  ImportReviewRequiredError: class extends Error {},
}));
afterEach(cleanup);

it('renders uploaded row counts and clears them when returning to upload', async () => {
  const { container } = render(<ImportDialog open onOpenChange={vi.fn()} />);
  const input = container.ownerDocument.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  const file = new File(
    ['description,amount,date\nCoffee,12,2026-11-12\nLunch,25,2026-11-12'],
    'sample.csv',
    { type: 'text/csv' },
  );
  Object.defineProperty(file, 'text', {
    value: async () => 'description,amount,date\nCoffee,12,2026-11-12\nLunch,25,2026-11-12',
  });
  fireEvent.change(input!, { target: { files: [file] } });
  expect(await screen.findByText('(2 rows, 3 columns)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /back/ }));
  expect(screen.queryByText('(2 rows, 3 columns)')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'dragDropCsv' })).toBeInTheDocument();
});
