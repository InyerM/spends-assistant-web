import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransactionToolbar } from '@/components/transactions/transaction-toolbar';

vi.mock('next-intl', () => ({
  useTranslations:
    (namespace: string) =>
    (key: string): string =>
      (
        ({
          'common.import': 'Import',
          'common.export': 'Export',
          'common.new': 'New',
          'common.select': 'Select',
          'transactions.newTransaction': 'New transaction',
          'transactions.uploadDocument': 'Upload receipt',
          'transactions.moreActions': 'More actions',
          'transactions.importHistory': 'Import history',
          'transactions.shortcutInbox': 'Shortcut inbox',
          'transactions.accountCorrections': 'Review debit account',
        }) as Record<string, string>
      )[`${namespace}.${key}`] ?? key,
}));
vi.mock('@/components/transactions/period-selector', () => ({
  PeriodSelector: () => <button type='button'>September 2026</button>,
}));

describe('transaction toolbar', () => {
  it('keeps new transaction and receipt upload available without a crowded action row', () => {
    const onNew = vi.fn();
    render(
      <TransactionToolbar
        dateFrom='2026-09-01'
        dateTo='2026-09-30'
        onPeriodChange={vi.fn()}
        onNew={onNew}
        onImport={vi.fn()}
        onExport={vi.fn()}
        onSelect={vi.fn()}
        exportDisabled={false}
      />,
    );

    expect(screen.getByRole('link', { name: /upload receipt/i })).toHaveAttribute(
      'href',
      '/documents?from=transactions',
    );
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review debit account' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New transaction' }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
