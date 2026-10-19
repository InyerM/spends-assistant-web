'use client';
import { NotificationWidget } from './notification-widget';
import { useTranslations } from 'next-intl';
import { Inbox, Files } from 'lucide-react';
import { usePendingInboxCount } from '@/lib/api/queries/inbox-pending.queries';
import { usePendingDocumentCount } from '@/lib/api/queries/document-pending.queries';
export function PendingReviewWidget({ kind }: { kind: 'inbox' | 'documents' }): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  const inbox = usePendingInboxCount(),
    documents = usePendingDocumentCount();
  const query = kind === 'inbox' ? inbox : documents;
  const Icon = kind === 'inbox' ? Inbox : Files;
  return (
    <NotificationWidget
      title={t(kind === 'inbox' ? 'reviewInbox' : 'reviewDocuments')}
      count={query.isError ? '—' : (query.data ?? '—')}
      detail={t(
        query.isError ? 'reviewUnavailable' : query.data === 0 ? 'reviewClear' : 'reviewPending',
      )}
      href={kind === 'inbox' ? '/inbox' : '/documents'}
      linkLabel={t('reviewViewMore')}
      icon={Icon}
    />
  );
}
