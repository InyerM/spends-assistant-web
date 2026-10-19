'use client';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InboxItem } from '@/types/shortcut-inbox';
export function CompletedInboxCard({
  item,
  description,
}: {
  item: InboxItem;
  description?: string | null;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  return (
    <section
      id={`inbox-${item.id}`}
      className='border-success/25 bg-success/5 min-w-0 rounded-xl border p-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <CheckCircle2 className='text-success size-5 shrink-0' aria-hidden='true' />
        <div className='min-w-0 flex-1'>
          <Badge variant='outline' className='border-success/30 bg-success/10 text-success'>
            {t('created')}
          </Badge>
          <p className='text-muted-foreground truncate text-xs'>
            {description ||
              t(item.source === 'forwarded_email' ? 'forwardedSource' : 'confirmedMovement')}
          </p>
        </div>
        {item.match && (
          <Link
            className='text-success inline-flex min-h-10 items-center gap-1 text-sm hover:underline'
            href={`/transactions/${item.match.transaction_id}`}>
            {t('viewCreatedTransaction')}
            <ArrowUpRight className='size-4' aria-hidden='true' />
          </Link>
        )}
      </div>
    </section>
  );
}
