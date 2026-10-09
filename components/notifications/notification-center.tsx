'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NotificationRow } from '@/components/notifications/notification-row';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useMarkNotificationsRead,
  useNotifications,
} from '@/lib/api/queries/notifications.queries';

export function NotificationCenter(): React.ReactElement {
  const t = useTranslations('notifications');
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = query.data?.unread_count ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative h-11 w-11 shrink-0'
          aria-label={t('open', { count: unread })}>
          <Bell className='h-5 w-5' aria-hidden='true' />
          {unread > 0 ? (
            <span className='bg-brand text-brand-foreground absolute top-1 right-0 rounded-full px-1.5 text-[10px] tabular-nums'>
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[min(24rem,calc(100vw-2rem))] rounded-xl p-0'>
        <div className='border-border flex items-center justify-between gap-2 border-b p-4'>
          <h2 className='font-semibold'>{t('title')}</h2>
          <Button
            variant='ghost'
            size='sm'
            disabled={unread === 0 || markRead.isPending}
            onClick={() => markRead.mutate(undefined)}>
            {t('markAll')}
          </Button>
        </div>
        {query.isPending ? (
          <p className='text-muted-foreground p-4 text-sm'>{t('loading')}</p>
        ) : null}
        {query.isError ? (
          <div className='p-4 text-sm' role='alert'>
            <p>{t('error')}</p>
            <Button variant='ghost' onClick={() => void query.refetch()}>
              {t('retry')}
            </Button>
          </div>
        ) : null}
        {markRead.isError ? (
          <p className='text-destructive px-4 py-2 text-sm' role='alert'>
            {t('readError')}
          </p>
        ) : null}
        {query.data?.data.length === 0 ? (
          <p className='text-muted-foreground p-4 text-sm'>{t('empty')}</p>
        ) : null}
        <ul className='max-h-[60vh] overflow-y-auto'>
          {query.data?.data.map((notice) => (
            <NotificationRow
              key={notice.id}
              notice={notice}
              isPending={markRead.isPending}
              onMarkRead={(id) => markRead.mutate(id)}
            />
          ))}
        </ul>
        <div className='border-border flex flex-wrap gap-4 border-t p-4 text-sm'>
          <Link href='/notifications'>{t('viewAll')}</Link>
          <Link href='/inbox'>{t('allEmails')}</Link>
          <Link href='/budgets'>{t('budgets')}</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
