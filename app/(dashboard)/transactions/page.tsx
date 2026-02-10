'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionList } from '@/components/transactions/transaction-list';
import { TransactionFiltersBar } from '@/components/transactions/transaction-filters';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { Plus, Upload, Download } from 'lucide-react';
import { ImportDialog } from '@/components/transactions/import-dialog';
import { exportTransactionsCsv } from '@/lib/utils/export';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import type { Transaction, TransactionFilters } from '@/types';

type ListFilters = Omit<TransactionFilters, 'page' | 'limit' | 'date_from' | 'date_to'>;

export default function TransactionsPage(): React.ReactElement {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filters, setFilters] = useState<ListFilters>({});
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const { data: exportData } = useTransactions({
    ...filters,
    date_from: dateFrom,
    date_to: dateTo,
    limit: 500,
  });

  const handleEdit = (transaction: Transaction): void => {
    setEditingTransaction(transaction);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean): void => {
    setFormOpen(open);
    if (!open) setEditingTransaction(null);
  };

  const handleMonthChange = (newYear: number, newMonth: number): void => {
    setYear(newYear);
    setMonth(newMonth);
  };

  const handleExport = (): void => {
    if (exportData?.data) {
      exportTransactionsCsv(exportData.data);
    }
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-foreground text-2xl font-bold'>Transactions</h2>
          <p className='text-muted-foreground text-sm'>View and manage all your transactions</p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='cursor-pointer'
            onClick={(): void => setImportOpen(true)}>
            <Upload className='mr-1.5 h-4 w-4' />
            Import
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='cursor-pointer'
            onClick={handleExport}
            disabled={!exportData?.data.length}>
            <Download className='mr-1.5 h-4 w-4' />
            Export
          </Button>
          <Button className='cursor-pointer' onClick={(): void => setFormOpen(true)}>
            <Plus className='mr-2 h-4 w-4' />
            New Transaction
          </Button>
        </div>
      </div>

      <TransactionFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
        year={year}
        month={month}
        onMonthChange={handleMonthChange}
      />

      <TransactionList filters={filters} onEdit={handleEdit} year={year} month={month} />

      <TransactionForm
        open={formOpen}
        onOpenChange={handleFormClose}
        transaction={editingTransaction}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
