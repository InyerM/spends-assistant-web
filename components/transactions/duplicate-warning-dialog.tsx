'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import {
  forceCreateTransaction,
  replaceTransaction,
} from '@/lib/api/mutations/transaction.mutations';
import { useQueryClient } from '@tanstack/react-query';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import { accountKeys } from '@/lib/api/queries/account.queries';
import type { Transaction, CreateTransactionInput } from '@/types';

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTransaction: Transaction;
  newInput: CreateTransactionInput;
  onResolved: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  existingTransaction,
  newInput,
  onResolved,
}: DuplicateWarningDialogProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<'create' | 'replace' | null>(null);

  const getAccountName = (accountId: string): string =>
    accounts?.find((a) => a.id === accountId)?.name ?? '';

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId || !categories) return 'None';
    return categories.find((c) => c.id === categoryId)?.name ?? 'None';
  };

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    ]);
  };

  const handleCreateAnyway = async (): Promise<void> => {
    setPending('create');
    try {
      await forceCreateTransaction(newInput);
      await invalidate();
      toast.success(t('transactionCreated'));
      onOpenChange(false);
      onResolved();
    } catch {
      toast.error(t('failedToCreate'));
    } finally {
      setPending(null);
    }
  };

  const handleReplace = async (): Promise<void> => {
    setPending('replace');
    try {
      await replaceTransaction(newInput, existingTransaction.id);
      await invalidate();
      toast.success(t('transactionReplaced'));
      onOpenChange(false);
      onResolved();
    } catch {
      toast.error(t('failedToReplace'));
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card w-[calc(100vw-2rem)] max-w-[540px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='text-warning h-5 w-5' />
            {t('duplicateWarning')}
          </DialogTitle>
        </DialogHeader>

        <p className='text-muted-foreground text-sm'>{t('duplicateExists')}</p>

        <div className='grid grid-cols-2 gap-2'>
          <ComparisonCard
            label={t('existing')}
            amount={existingTransaction.amount}
            description={existingTransaction.description}
            date={existingTransaction.date}
            account={getAccountName(existingTransaction.account_id)}
            category={getCategoryName(existingTransaction.category_id)}
            type={existingTransaction.type}
          />
          <ComparisonCard
            label={tCommon('new')}
            amount={newInput.amount}
            description={newInput.description}
            date={newInput.date}
            account={getAccountName(newInput.account_id)}
            category={getCategoryName(newInput.category_id ?? null)}
            type={newInput.type}
            highlight
          />
        </div>

        <div className='flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end'>
          <Button variant='outline' onClick={(): void => onOpenChange(false)} disabled={!!pending}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant='outline'
            onClick={(): void => void handleCreateAnyway()}
            disabled={!!pending}>
            {pending === 'create' ? tCommon('creating') : t('createAnyway')}
          </Button>
          <Button onClick={(): void => void handleReplace()} disabled={!!pending}>
            {pending === 'replace' ? t('replacing') : t('replaceExisting')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComparisonCard({
  label,
  amount,
  description,
  date,
  account,
  category,
  type,
  highlight,
}: {
  label: string;
  amount: number;
  description: string;
  date: string;
  account: string;
  category: string;
  type: string;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`max-h-[180px] overflow-hidden rounded-lg border p-2.5 ${
        highlight ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/50'
      }`}>
      <span className='text-muted-foreground mb-1 block text-[10px] font-medium tracking-wide uppercase'>
        {label}
      </span>
      <p className='text-base leading-tight font-semibold'>{formatCurrency(amount)}</p>
      <p className='mt-0.5 truncate text-xs'>{description}</p>
      <div className='text-muted-foreground mt-1.5 space-y-0 text-[11px] leading-snug'>
        <p>{date}</p>
        <p className='truncate'>{account}</p>
        <p>
          {type} &middot; {category}
        </p>
      </div>
    </div>
  );
}
