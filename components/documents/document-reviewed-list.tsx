'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { DocumentObservation } from '@/lib/api/queries/document.queries';

interface Props {
  documentId: string;
  observations: DocumentObservation[];
  status: 'confirmed' | 'rejected';
  busy: boolean;
  onRestore: (documentId: string, observationId: string) => void;
}

export function DocumentReviewedList({
  documentId,
  observations,
  status,
  busy,
  onRestore,
}: Props): React.ReactElement | null {
  const t = useTranslations('documents');
  const reviewed = observations.filter((observation) => observation.status === status);
  if (reviewed.length === 0) return null;

  return (
    <details className='border-border border-t pt-3'>
      <summary className='text-muted-foreground cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-offset-2'>
        {t(status === 'confirmed' ? 'confirmedObservations' : 'rejectedObservations')} ·{' '}
        {reviewed.length}
      </summary>
      <div className='mt-3 divide-y rounded-lg border'>
        {reviewed.map((observation) => (
          <div
            key={observation.id}
            className='flex flex-wrap items-center justify-between gap-2 px-3 py-3'>
            <div className='min-w-0'>
              <p className='text-sm font-medium break-words'>{observation.description}</p>
              <p className='text-muted-foreground text-xs'>
                {observation.occurred_at_text ?? t('dateUnknown')}
              </p>
            </div>
            {status === 'confirmed' && observation.match_transaction_id && (
              <Link
                href={`/transactions/${observation.match_transaction_id}`}
                className='text-primary text-sm font-medium underline underline-offset-2'>
                {t('reviewExistingTransaction')}
              </Link>
            )}
            {status === 'rejected' && (
              <Button
                size='sm'
                variant='outline'
                disabled={busy}
                onClick={() => onRestore(documentId, observation.id)}>
                {t('restoreObservation')}
              </Button>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
