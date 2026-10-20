'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import { useTransaction } from '@/lib/api/queries/transaction.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useResolveDuplicate } from '@/lib/api/mutations/transaction.mutations';
import { formatCurrency } from '@/lib/utils/formatting';
import type { Transaction } from '@/types';
export function DuplicateReference({
  transaction,
  onResolved,
}: {
  transaction: Transaction;
  onResolved: () => void;
}): React.ReactElement {
  const t = useTranslations('transactions'),
    locale = useLocale();
  const reference = useTransaction(transaction.duplicate_of ?? '');
  const accounts = useAccounts();
  const resolve = useResolveDuplicate();
  const match = reference.data?.id !== transaction.id ? reference.data : undefined;
  const account = accounts.data?.find((a) => a.id === match?.account_id);
  return (
    <section
      className='border-warning/30 bg-warning/5 space-y-3 rounded-lg border p-3'
      aria-label={t('duplicateWarning')}>
      <div className='flex items-start gap-2'>
        <AlertTriangle className='text-warning mt-0.5 size-4 shrink-0' />
        <div>
          <p className='text-sm font-medium'>{t('duplicateWarning')}</p>
          <p className='text-muted-foreground text-xs'>{t('duplicateCompareHint')}</p>
        </div>
      </div>
      {transaction.duplicate_of && reference.isPending ? (
        <InlineLoader />
      ) : match ? (
        <div className='bg-card-overlay space-y-1 rounded-md p-3 text-sm'>
          <p className='font-medium break-words'>{match.description}</p>
          <p className='text-muted-foreground text-xs'>
            {match.date}
            {match.time ? ` · ${match.time.slice(0, 5)}` : ''}
            {account ? ` · ${account.name}` : ''}
          </p>
          <p className='font-medium tabular-nums'>
            {formatCurrency(match.amount, match.currency ?? account?.currency ?? 'COP', locale)}
          </p>
          <Link
            className='text-success inline-flex items-center gap-1 text-xs underline'
            href={`/transactions/${match.id}`}
            target='_blank'
            rel='noopener noreferrer'>
            {t('viewDuplicate')}
            <ExternalLink className='size-3' />
          </Link>
        </div>
      ) : (
        <p role='status' className='text-muted-foreground text-xs'>
          {t('duplicateReferenceUnavailable')}
        </p>
      )}
      {resolve.error && (
        <p role='alert' className='text-destructive text-xs'>
          {t('duplicateResolveFailed')}
        </p>
      )}
      <div className='flex flex-wrap gap-2'>
        {(['keep', 'delete'] as const).map((action) => (
          <Button
            key={action}
            type='button'
            size='sm'
            variant={action === 'keep' ? 'outline' : 'ghost'}
            className={action === 'delete' ? 'text-destructive' : ''}
            disabled={resolve.isPending}
            onClick={() =>
              resolve.mutate(
                { id: transaction.id, action },
                {
                  onSuccess: () => {
                    toast.success(
                      t(action === 'keep' ? 'markedAsNotDuplicate' : 'duplicateDeleted'),
                    );
                    onResolved();
                  },
                },
              )
            }>
            {resolve.isPending && <InlineLoader />}
            {t(action === 'keep' ? 'keepBoth' : 'deleteThisOne')}
          </Button>
        ))}
      </div>
    </section>
  );
}
