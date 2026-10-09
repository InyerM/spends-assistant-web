'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ForwardedEmailEvidence } from '@/components/transactions/forwarded-email-evidence';
import { useTransactionOrigin } from '@/lib/api/queries/transaction-origin.queries';

export function TransactionOrigin({
  transactionId,
}: {
  transactionId: string;
}): React.ReactElement | null {
  const t = useTranslations('transactions');
  const query = useTransactionOrigin(transactionId);
  const [expanded, setExpanded] = useState(false);
  if (query.isError)
    return (
      <p className='text-muted-foreground text-sm' role='status'>
        {t('originUnavailable')}
      </p>
    );
  const { document, inbox } = query.data ?? { document: null, inbox: null };
  if (!document && !inbox) return null;
  return (
    <div className='border-border space-y-3 rounded-lg border p-3'>
      <p className='text-muted-foreground text-xs font-medium'>{t('originalEvidence')}</p>
      {document && (
        <Button variant='outline' size='sm' className='max-w-full min-w-0' asChild>
          <Link href={`/documents#document-${document.id}`}>
            <FileText className='h-4 w-4' />
            <span className='truncate'>
              {t('viewOriginalDocument')} · {document.file_name}
            </span>
          </Link>
        </Button>
      )}
      {inbox && (
        <div className='space-y-3'>
          <Button
            variant='outline'
            size='sm'
            aria-expanded={expanded}
            onClick={(): void => setExpanded((value) => !value)}>
            <Mail className='h-4 w-4' />
            {t(inbox.source === 'forwarded_email' ? 'viewOriginalEmail' : 'viewOriginalMessage')}
          </Button>
          {expanded && <ForwardedEmailEvidence source={inbox.source} rawText={inbox.raw_text} />}
        </div>
      )}
    </div>
  );
}
