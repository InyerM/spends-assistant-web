'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionList } from '@/components/transactions/transaction-list';
import { TransactionFiltersBar } from '@/components/transactions/transaction-filters';
import { BulkEditDialog } from '@/components/transactions/bulk-edit-dialog';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Upload,
  Download,
  MoreVertical,
  CheckSquare,
  X,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { ImportDialog } from '@/components/transactions/import-dialog';
import { AiParseDialog } from '@/components/transactions/ai-parse-dialog';
import { exportTransactionsCsv } from '@/lib/utils/export';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import type { Transaction, TransactionFilters } from '@/types';

type ListFilters = Omit<TransactionFilters, 'page' | 'limit'>;

function getInitialDates(): { date_from: string; date_to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    date_from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    date_to: `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export default function TransactionsPage(): React.ReactElement {
  const [filters, setFilters] = useState<ListFilters>(getInitialDates);
  const [importOpen, setImportOpen] = useState(false);
  const [aiParseOpen, setAiParseOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const { openNew, openWith } = useTransactionFormStore();

  const { data: exportData } = useTransactions({ ...filters, limit: 500 });

  const handleEdit = (transaction: Transaction): void => {
    openWith(transaction);
  };

  const handleExport = (): void => {
    if (exportData?.data) {
      exportTransactionsCsv(exportData.data);
    }
  };

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exitSelectMode = (): void => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkComplete = (): void => {
    exitSelectMode();
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {selectMode ? (
        <div className='bg-card border-border flex items-center justify-between gap-2 rounded-lg border p-3'>
          <div className='flex items-center gap-3'>
            <Button
              variant='ghost'
              size='sm'
              className='cursor-pointer px-2'
              onClick={exitSelectMode}>
              <X className='h-4 w-4' />
            </Button>
            <span className='text-sm font-medium'>{selectedIds.size} selected</span>
          </div>
          <Button
            size='sm'
            className='cursor-pointer'
            disabled={selectedIds.size === 0}
            onClick={(): void => setBulkEditOpen(true)}>
            <Pencil className='mr-1.5 h-4 w-4' />
            Edit
          </Button>
        </div>
      ) : (
        <div className='flex items-center justify-between gap-2'>
          <div className='min-w-0'>
            <h2 className='text-foreground text-xl font-bold sm:text-2xl'>Transactions</h2>
            <p className='text-muted-foreground hidden text-sm sm:block'>
              View and manage all your transactions
            </p>
          </div>
          <div className='flex shrink-0 gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='cursor-pointer'
              onClick={(): void => setSelectMode(true)}>
              <CheckSquare className='h-4 w-4 sm:mr-1.5' />
              <span className='hidden sm:inline'>Select</span>
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='hidden cursor-pointer sm:flex'
              onClick={(): void => setImportOpen(true)}>
              <Upload className='mr-1.5 h-4 w-4' />
              Import
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='hidden cursor-pointer sm:flex'
              onClick={handleExport}
              disabled={!exportData?.data.length}>
              <Download className='mr-1.5 h-4 w-4' />
              Export
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='ai-gradient-btn cursor-pointer border-purple-500/50 text-purple-400 hover:border-purple-400 hover:text-purple-300'
              onClick={(): void => setAiParseOpen(true)}>
              <Sparkles className='h-4 w-4 sm:mr-1.5' />
              <span className='hidden sm:inline'>AI</span>
            </Button>
            <Button size='sm' className='cursor-pointer' onClick={openNew}>
              <Plus className='mr-1 h-4 w-4' />
              <span className='hidden sm:inline'>New Transaction</span>
              <span className='sm:hidden'>New</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' className='cursor-pointer px-2 sm:hidden'>
                  <MoreVertical className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  className='cursor-pointer'
                  onClick={(): void => setImportOpen(true)}>
                  <Upload className='mr-2 h-4 w-4' />
                  Import
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='cursor-pointer'
                  onClick={handleExport}
                  disabled={!exportData?.data.length}>
                  <Download className='mr-2 h-4 w-4' />
                  Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <TransactionFiltersBar filters={filters} onFiltersChange={setFilters} />

      <TransactionList
        filters={filters}
        onEdit={handleEdit}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <AiParseDialog open={aiParseOpen} onOpenChange={setAiParseOpen} />

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={selectedIds}
        onComplete={handleBulkComplete}
      />
    </div>
  );
}
