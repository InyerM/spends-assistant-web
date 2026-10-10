'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileImage, FileText, ScanText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InlineLoader } from '@/components/shared/loader';
import { StatementReconciliation } from '@/components/documents/statement-reconciliation';
import { DocumentBatchReview } from '@/components/documents/document-batch-review';
import { DocumentReviewedList } from '@/components/documents/document-reviewed-list';
import type { ReviewHistoryObservation } from '@/lib/document-review';
import type { DocumentSuggestionGroup, StoredDocument } from '@/lib/api/queries/document.queries';
import { documentNeedsReview } from '@/lib/documents/pending';
import type { Account, Category } from '@/types';

interface Props {
  document: StoredDocument;
  history: ReviewHistoryObservation[];
  accounts: Account[];
  categories: Category[];
  suggestions?: DocumentSuggestionGroup[];
  busy: string | null;
  suggestionsBusy: boolean;
  onOpen: () => void;
  onArchive: (archived: boolean) => void;
  onExtract: () => void;
  onRestore: (documentId: string, observationId: string) => void;
  onRefresh: () => Promise<void>;
}

export function DocumentCaptureCard({
  document,
  history,
  accounts,
  categories,
  suggestions,
  busy,
  suggestionsBusy,
  onOpen,
  onArchive,
  onExtract,
  onRestore,
  onRefresh,
}: Props): React.ReactElement {
  const t = useTranslations('documents');
  const [staleProcessingTimestamp, setStaleProcessingTimestamp] = useState<string | null>(null);
  useEffect((): (() => void) | undefined => {
    if (document.status !== 'processing') return;
    const remaining = 5 * 60 * 1000 - (Date.now() - new Date(document.updated_at).getTime());
    const timer = window.setTimeout(
      () => setStaleProcessingTimestamp(document.updated_at),
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(timer);
  }, [document.status, document.updated_at]);
  const canExtract =
    !document.archived_at &&
    (document.status === 'uploaded' ||
      document.status === 'failed' ||
      (document.status === 'processing' && staleProcessingTimestamp === document.updated_at));

  return (
    <Card id={`document-${document.id}`} className='scroll-mt-6 gap-0 py-0'>
      <CardContent className='space-y-4 p-4 sm:p-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='flex min-w-0 items-start gap-3'>
            <span className='bg-card-overlay text-muted-foreground rounded-lg p-2'>
              {document.mime_type === 'application/pdf' ? (
                <FileText className='h-5 w-5' aria-hidden='true' />
              ) : (
                <FileImage className='h-5 w-5' aria-hidden='true' />
              )}
            </span>
            <div className='min-w-0'>
              <h3 className='truncate font-medium'>{document.file_name}</h3>
              <p className='text-muted-foreground mt-1 text-xs'>
                {new Date(document.created_at).toLocaleString()} ·{' '}
                {document.document_type ? t(`type.${document.document_type}`) : t('unclassified')}
              </p>
              <div className='mt-2 flex flex-wrap items-center gap-2 text-xs'>
                <Badge variant='outline'>
                  {t(document.source_inbox_item_id ? 'sourceEmail' : 'sourceUpload')}
                </Badge>
                {documentNeedsReview(document) ? (
                  <Badge variant='secondary' className='bg-brand-secondary/15 text-brand-secondary'>
                    {t('pendingCapture')}
                  </Badge>
                ) : null}
                {document.source_inbox_item_id ? (
                  <Link
                    href={`/inbox/${document.source_inbox_item_id}`}
                    className='text-brand underline-offset-4 hover:underline'>
                    {t('viewSourceEmail')}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant='outline'
              className={
                document.status === 'extracted'
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : document.status === 'failed'
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-brand-secondary/30 bg-brand-secondary/10 text-brand-secondary'
              }>
              {t(`status.${document.status}`)}
            </Badge>
            <Button
              size='sm'
              variant='ghost'
              className={
                document.archived_at
                  ? undefined
                  : 'text-destructive hover:bg-destructive/10 hover:text-destructive'
              }
              disabled={busy !== null}
              onClick={() => onArchive(!document.archived_at)}>
              {document.archived_at ? t('restoreCapture') : t('archiveCapture')}
            </Button>
            {canExtract && (
              <Button size='sm' variant='ai' disabled={busy !== null} onClick={onExtract}>
                {busy === document.id ? (
                  <InlineLoader />
                ) : (
                  <ScanText className='size-4' aria-hidden='true' />
                )}
                {busy === document.id ? t('extracting') : t('extract')}
              </Button>
            )}
          </div>
        </div>
        {document.status === 'extracted' && !document.archived_at && (
          <details
            className='border-border border-t pt-4'
            onToggle={(event) =>
              event.currentTarget.open && !suggestions && !suggestionsBusy && onOpen()
            }>
            <summary className='text-foreground cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2'>
              {t('observations')} · {document.document_observations.length}
            </summary>
            <div className='mt-4 space-y-4'>
              {document.document_type === 'statement' ? (
                <StatementReconciliation documentId={document.id} accounts={accounts} />
              ) : (
                <DocumentBatchReview
                  documentId={document.id}
                  rows={document.document_observations.map((observation) => ({
                    ...observation,
                    document_type: document.document_type,
                  }))}
                  history={history}
                  accounts={accounts}
                  categories={categories}
                  suggestions={suggestions}
                  onRefresh={onRefresh}
                />
              )}
              {document.document_observations.length === 0 && (
                <p className='text-muted-foreground text-sm'>{t('noObservations')}</p>
              )}
              <DocumentReviewedList
                documentId={document.id}
                observations={document.document_observations}
                status='confirmed'
                busy={busy !== null}
                onRestore={onRestore}
              />
              <DocumentReviewedList
                documentId={document.id}
                observations={document.document_observations}
                status='rejected'
                busy={busy !== null}
                onRestore={onRestore}
              />
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
