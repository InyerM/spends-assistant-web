'use client';
import Link from 'next/link';
import { Check, Mail, Target } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { OwnerNotification } from '@/lib/api/queries/notifications.queries';
export function NotificationRow({
  notice,
  isPending,
  onMarkRead,
}: {
  notice: OwnerNotification;
  isPending: boolean;
  onMarkRead: (id: string) => void;
}): React.ReactElement {
  const t = useTranslations('notifications');
  const format = useFormatter();
  return (
    <li className='border-border flex items-start gap-3 border-b p-4 last:border-0'>
      {notice.kind === 'email_received' ? (
        <Mail className='text-muted-foreground mt-1 h-4 w-4 shrink-0' aria-hidden='true' />
      ) : (
        <Target className='text-brand-secondary mt-1 h-4 w-4 shrink-0' aria-hidden='true' />
      )}
      <div className='min-w-0 flex-1'>
        <Link
          href={notice.kind === 'email_received' ? '/inbox' : '/budgets'}
          className='focus-visible:ring-ring block rounded-sm focus-visible:ring-2'>
          <p
            className={
              notice.read_at
                ? 'text-muted-foreground text-sm'
                : 'text-foreground text-sm font-semibold'
            }>
            {t(notice.kind)}
          </p>
          <p className='text-muted-foreground mt-1 line-clamp-2 text-xs break-words'>
            {notice.label}
          </p>
        </Link>
        <span className='text-muted-foreground mt-1 block text-xs'>
          {notice.read_at ? t('read') : t('unread')}
        </span>
        <time dateTime={notice.created_at} className='text-muted-foreground mt-1 block text-xs'>
          {format.dateTime(new Date(notice.created_at), {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </time>
      </div>
      {!notice.read_at ? (
        <Button
          variant='ghost'
          size='icon'
          className='h-11 w-11 shrink-0'
          disabled={isPending}
          aria-label={t('markOne')}
          onClick={() => onMarkRead(notice.id)}>
          <Check className='h-4 w-4' aria-hidden='true' />
        </Button>
      ) : null}
    </li>
  );
}
