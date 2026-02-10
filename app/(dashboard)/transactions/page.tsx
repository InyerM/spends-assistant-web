'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionList } from '@/components/transactions/transaction-list';
import { TransactionFiltersBar } from '@/components/transactions/transaction-filters';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { Plus } from 'lucide-react';
import type { Transaction, TransactionFilters } from '@/types';

export default function TransactionsPage(): React.ReactElement {
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: 20 });
  const [formOpen, setFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleEdit = (transaction: Transaction): void => {
    setEditingTransaction(transaction);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean): void => {
    setFormOpen(open);
    if (!open) setEditingTransaction(null);
  };

  return (
    <div className='space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-foreground text-2xl font-bold'>Transactions</h2>
          <p className='text-muted-foreground text-sm'>View and manage all your transactions</p>
        </div>
        <Button onClick={(): void => setFormOpen(true)}>
          <Plus className='mr-2 h-4 w-4' />
          New Transaction
        </Button>
      </div>

      <TransactionFiltersBar filters={filters} onFiltersChange={setFilters} />
      <TransactionList filters={filters} onFiltersChange={setFilters} onEdit={handleEdit} />

      <TransactionForm
        open={formOpen}
        onOpenChange={handleFormClose}
        transaction={editingTransaction}
      />
    </div>
  );
}
