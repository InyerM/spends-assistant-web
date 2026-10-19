'use client';
import { useTranslations } from 'next-intl';
import { LoaderCircle, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CategoryReview } from '@/lib/category-review';
export function StatementAnalysisFeedback({
  pending,
  result,
  cardPayment,
  disabled,
  resolution,
  onResolve,
}: {
  pending: boolean;
  result?: CategoryReview;
  cardPayment: boolean;
  disabled: boolean;
  resolution?: 'unconfirmed' | 'transfer' | 'refund' | 'other';
  onResolve: (choice: 'transfer' | 'refund' | 'other') => void;
}): React.ReactElement | null {
  const t = useTranslations('statementReconciliation');
  if (pending)
    return (
      <p role='status' className='text-muted-foreground flex items-center gap-2 text-sm'>
        <LoaderCircle className='size-4 motion-safe:animate-spin' />
        {t('analyzingFields')}
      </p>
    );
  if (cardPayment || result?.kind === 'own_transfer')
    return (
      <div className='border-warning/30 bg-warning/5 space-y-3 rounded-lg border p-3'>
        <p className='text-warning flex items-center gap-2 text-sm font-medium'>
          <Info className='size-4' />
          {t(cardPayment ? 'cardPaymentTitle' : 'transferReviewTitle')}
        </p>
        <p className='text-muted-foreground text-sm'>
          {t(cardPayment ? 'cardPaymentHint' : 'transferReviewHint')}
        </p>
        <div className='flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={disabled}
            aria-pressed={resolution === 'transfer'}
            className={
              resolution === 'transfer'
                ? 'border-success text-success dark:border-success dark:bg-success/10'
                : ''
            }
            onClick={() => onResolve('transfer')}>
            {t('confirmOwnPayment')}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            disabled={disabled}
            aria-pressed={resolution === 'refund'}
            className={
              resolution === 'refund'
                ? 'border-success text-success dark:border-success dark:bg-success/10'
                : ''
            }
            onClick={() => onResolve('refund')}>
            {t('confirmRefund')}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            disabled={disabled}
            aria-pressed={resolution === 'other'}
            className={
              resolution === 'other'
                ? 'border-success text-success dark:border-success dark:bg-success/10'
                : ''
            }
            onClick={() => onResolve('other')}>
            {t('confirmOtherIncome')}
          </Button>
        </div>
      </div>
    );
  if (!result) return null;
  return (
    <div role='status' className='bg-muted/40 space-y-1 rounded-lg p-3 text-sm'>
      <p className='flex items-center gap-2 font-medium'>
        {result.category_id ? (
          <Check className='text-success size-4' />
        ) : (
          <Info className='size-4' />
        )}
        {t(result.category_id ? 'analysisSuggested' : 'analysisNeedsCategory')}
      </p>
      <p className='text-muted-foreground'>{result.explanation}</p>
    </div>
  );
}
