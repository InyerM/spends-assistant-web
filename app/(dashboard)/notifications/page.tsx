'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { NotificationRow } from '@/components/notifications/notification-row';
import {
  useNotifications,
  useMarkNotificationsRead,
} from '@/lib/api/queries/notifications.queries';

export default function NotificationsPage(): React.ReactElement {
  const t = useTranslations('notifications');
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const query = useNotifications({ page, limit: 20, unread });
  const markRead = useMarkNotificationsRead();
  const handleMarkRead = (id?: string): void => {
    markRead.mutate(id, {
      onSuccess: () => {
        if (unread) setPage(1);
      },
    });
  };
  const total = query.data?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <div className='mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        <Button
          variant='outline'
          disabled={markRead.isPending || !query.data?.unread_count}
          onClick={() => handleMarkRead()}>
          {t('markAll')}
        </Button>
      </div>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex gap-2' role='group' aria-label={t('filter')}>
          <Button
            variant={unread ? 'ghost' : 'secondary'}
            aria-pressed={!unread}
            onClick={() => {
              setUnread(false);
              setPage(1);
            }}>
            {t('all')}
          </Button>
          <Button
            variant={unread ? 'secondary' : 'ghost'}
            aria-pressed={unread}
            onClick={() => {
              setUnread(true);
              setPage(1);
            }}>
            {t('unread')}
          </Button>
        </div>
        <Link href='/inbox' className='text-muted-foreground text-sm underline underline-offset-4'>
          {t('allEmails')}
        </Link>
      </div>
      {query.isPending ? (
        <p className='text-muted-foreground text-sm' role='status'>
          {t('loading')}
        </p>
      ) : null}
      {query.isError ? (
        <div role='alert'>
          <p>{t('error')}</p>
          <Button variant='outline' onClick={() => void query.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {markRead.isError ? (
        <p role='alert' className='text-destructive text-sm'>
          {t('readError')}
        </p>
      ) : null}
      {query.data && query.data.data.length === 0 ? (
        <p className='text-muted-foreground py-8 text-sm'>{t('empty')}</p>
      ) : null}
      {query.data && query.data.data.length > 0 ? (
        <ul className='border-border overflow-hidden rounded-xl border'>
          {query.data.data.map((notice) => (
            <NotificationRow
              key={notice.id}
              notice={notice}
              isPending={markRead.isPending}
              onMarkRead={handleMarkRead}
            />
          ))}
        </ul>
      ) : null}
      <nav aria-label={t('pagination')} className='flex items-center justify-between gap-2'>
        <Button
          variant='outline'
          disabled={page <= 1 || query.isFetching}
          onClick={() => setPage((current) => Math.max(1, current - 1))}>
          {t('previous')}
        </Button>
        <p className='text-muted-foreground text-sm tabular-nums' aria-live='polite'>
          {t('page', { page, pages: Math.max(page, pages), count: total })}
        </p>
        <Button
          variant='outline'
          disabled={page >= pages || query.isFetching || query.isError}
          onClick={() => setPage((current) => current + 1)}>
          {t('next')}
        </Button>
      </nav>
    </div>
  );
}
