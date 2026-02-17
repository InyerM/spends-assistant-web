'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TransactionList } from '@/components/transactions/transaction-list';
import { TransactionFiltersBar } from '@/components/transactions/transaction-filters';
import { PeriodSelector } from '@/components/transactions/period-selector';
import { BulkEditDialog } from '@/components/transactions/bulk-edit-dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';

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
  Trash2,
  History,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { ImportDialog } from '@/components/transactions/import-dialog';
import { exportTransactionsCsv } from '@/lib/utils/export';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useInfiniteTransactions } from '@/lib/api/queries/transaction.queries';
import { useBulkDeleteTransactions } from '@/lib/api/mutations/transaction.mutations';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { toast } from 'sonner';
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
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();

  const importIdParam = searchParams.get('import_id');

  const [filters, setFilters] = useState<ListFilters>(() => ({
    ...getInitialDates(),
    ...(importIdParam ? { import_id: importIdParam } : {}),
  }));
  const [importOpen, setImportOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { openNew, openWith } = useTransactionFormStore();

  // Merge import_id from URL into filters during render (no effect needed)
  const effectiveFilters = useMemo((): ListFilters => {
    if (importIdParam && filters.import_id !== importIdParam) {
      return { ...filters, import_id: importIdParam };
    }
    return filters;
  }, [filters, importIdParam]);

  const { data: exportData } = useTransactions({ ...effectiveFilters, limit: 500 });
  const { data: infiniteData } = useInfiniteTransactions(effectiveFilters);
  const bulkDeleteMutation = useBulkDeleteTransactions();

  const allLoadedIds = infiniteData?.pages.flatMap((p) => p.data).map((tx) => tx.id) ?? [];

  const allSelected = allLoadedIds.length > 0 && allLoadedIds.every((id) => selectedIds.has(id));
  const someSelected = allLoadedIds.some((id) => selectedIds.has(id));

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

  const toggleSelectAll = (): void => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allLoadedIds));
    }
  };

  const exitSelectMode = (): void => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkComplete = (): void => {
    exitSelectMode();
  };

  const handleBulkDelete = async (): Promise<void> => {
    try {
      const ids = [...selectedIds];
      await bulkDeleteMutation.mutateAsync(ids);
      toast.success(t('transactionsDeleted', { count: ids.length }));
      setBulkDeleteOpen(false);
      exitSelectMode();
    } catch {
      toast.error(t('failedToBulkDelete'));
    }
  };

  const handlePeriodChange = useCallback((dateFrom: string, dateTo: string): void => {
    setFilters((prev) => ({ ...prev, date_from: dateFrom, date_to: dateTo }));
  }, []);

  const clearImportFilter = (): void => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next.import_id;
      return next;
    });
    router.replace('/transactions');
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      {selectMode ? (
        <div className='bg-card border-border flex items-center justify-between gap-2 rounded-lg border p-2 sm:p-3'>
          <div className='flex min-w-0 items-center gap-2 sm:gap-3'>
            <Button
              variant='ghost'
              size='sm'
              className='shrink-0 cursor-pointer px-2'
              onClick={exitSelectMode}>
              <X className='h-4 w-4' />
            </Button>
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleSelectAll}
              className='shrink-0'
            />
            <span className='truncate text-sm font-medium'>
              {tCommon('selected', { count: selectedIds.size })}
            </span>
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            <Button
              variant='destructive'
              size='sm'
              className='cursor-pointer'
              disabled={selectedIds.size === 0}
              onClick={(): void => setBulkDeleteOpen(true)}>
              <Trash2 className='h-4 w-4 sm:mr-1.5' />
              <span className='hidden sm:inline'>{tCommon('delete')}</span>
            </Button>
            <Button
              size='sm'
              className='cursor-pointer'
              disabled={selectedIds.size === 0}
              onClick={(): void => setBulkEditOpen(true)}>
              <Pencil className='h-4 w-4 sm:mr-1.5' />
              <span className='hidden sm:inline'>{tCommon('edit')}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex items-center justify-between gap-3'>
          <PeriodSelector
            dateFrom={effectiveFilters.date_from ?? ''}
            dateTo={effectiveFilters.date_to ?? ''}
            onChange={handlePeriodChange}
          />
          <div className='flex shrink-0 gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='cursor-pointer'
              onClick={(): void => setSelectMode(true)}>
              <CheckSquare className='h-4 w-4 sm:mr-1.5' />
              <span className='hidden sm:inline'>{tCommon('select')}</span>
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='hidden cursor-pointer sm:flex'
              onClick={(): void => setImportOpen(true)}>
              <Upload className='mr-1.5 h-4 w-4' />
              {tCommon('import')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='hidden cursor-pointer sm:flex'
              onClick={handleExport}
              disabled={!exportData?.data.length}>
              <Download className='mr-1.5 h-4 w-4' />
              {tCommon('export')}
            </Button>
            <Button variant='ghost' size='sm' className='hidden cursor-pointer sm:flex' asChild>
              <Link href='/transactions/imports'>
                <History className='mr-1.5 h-4 w-4' />
                {t('importHistory')}
              </Link>
            </Button>
            <Button size='sm' className='cursor-pointer' onClick={openNew}>
              <Plus className='mr-1 h-4 w-4' />
              <span className='hidden sm:inline'>{t('newTransaction')}</span>
              <span className='sm:hidden'>{tCommon('new')}</span>
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
                  {tCommon('import')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className='cursor-pointer'
                  onClick={handleExport}
                  disabled={!exportData?.data.length}>
                  <Download className='mr-2 h-4 w-4' />
                  {tCommon('export')}
                </DropdownMenuItem>
                <DropdownMenuItem asChild className='cursor-pointer'>
                  <Link href='/transactions/imports'>
                    <History className='mr-2 h-4 w-4' />
                    {t('importHistory')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Import filter banner */}
      {effectiveFilters.import_id && (
        <div className='bg-muted/50 border-border flex items-center justify-between rounded-lg border px-3 py-2'>
          <div className='flex items-center gap-2 text-sm'>
            <FileText className='text-muted-foreground h-4 w-4' />
            <span>{t('fromImport', { name: effectiveFilters.import_id.slice(0, 8) })}</span>
          </div>
          <Button
            variant='ghost'
            size='sm'
            className='cursor-pointer text-xs'
            onClick={clearImportFilter}>
            <X className='mr-1 h-3 w-3' />
            {t('clearImportFilter')}
          </Button>
        </div>
      )}

      <TransactionFiltersBar filters={effectiveFilters} onFiltersChange={setFilters} />

      <TransactionList
        filters={effectiveFilters}
        onEdit={handleEdit}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={selectedIds}
        onComplete={handleBulkComplete}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('bulkDeleteTitle')}
        description={
          <p className='text-muted-foreground text-sm'>
            {t('bulkDeleteDescription', { count: selectedIds.size })}
          </p>
        }
        confirmText={String(selectedIds.size)}
        onConfirm={(): void => void handleBulkDelete()}
        isPending={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
