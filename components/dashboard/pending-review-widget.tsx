'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Inbox, Files, ArrowUpRight } from 'lucide-react';
import { usePendingInboxCount } from '@/lib/api/queries/inbox-pending.queries';
import { usePendingDocumentCount } from '@/lib/api/queries/document-pending.queries';
export function PendingReviewWidget({ kind }: { kind: 'inbox' | 'documents' }): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  const inbox = usePendingInboxCount(),
    documents = usePendingDocumentCount();
  const query = kind === 'inbox' ? inbox : documents;
  const Icon = kind === 'inbox' ? Inbox : Files;
  return (
    <section className='bg-card border-border min-w-0 rounded-xl border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-sm font-medium'>
          {t(kind === 'inbox' ? 'reviewInbox' : 'reviewDocuments')}
        </h2>
        <Icon aria-hidden='true' className='text-brand size-5 shrink-0' />
      </div>
      <div className='mt-3 flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='text-2xl font-semibold tabular-nums' role='status' aria-atomic='true'>
            <span className='sr-only'>
              {t(kind === 'inbox' ? 'reviewInbox' : 'reviewDocuments')}:{' '}
            </span>
            <span>{query.isError ? '—' : (query.data ?? '—')}</span>
          </p>
          <p className='text-muted-foreground text-xs'>
            {t(
              query.isError
                ? 'reviewUnavailable'
                : query.data === 0
                  ? 'reviewClear'
                  : 'reviewPending',
            )}
          </p>
        </div>
        <Link
          href={kind === 'inbox' ? '/inbox' : '/documents'}
          aria-label={`${t('reviewViewMore')} · ${t(kind === 'inbox' ? 'reviewInbox' : 'reviewDocuments')}`}
          className='text-brand focus-visible:ring-ring inline-flex min-h-11 items-center gap-1 text-sm hover:underline focus-visible:ring-2'>
          {t('reviewViewMore')}
          <ArrowUpRight aria-hidden='true' className='size-4' />
        </Link>
      </div>
    </section>
  );
}
