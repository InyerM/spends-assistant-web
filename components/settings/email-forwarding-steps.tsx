'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EmailForwardingRoute } from '@/lib/api/queries/email-forwarding.queries';

type ActiveRoute = Extract<EmailForwardingRoute, { status: 'active' }>;

function SetupStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <li className='relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-7 last:pb-0'>
      <span className='bg-muted text-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold'>
        {number}
      </span>
      <div className='min-w-0 space-y-2 pt-1'>
        <h3 className='text-sm font-semibold'>{title}</h3>
        {children}
      </div>
    </li>
  );
}

export function EmailForwardingSteps({
  route,
  confirmationCopied,
  isFetching,
  onCopy,
  onRefresh,
}: {
  route: ActiveRoute;
  confirmationCopied: boolean;
  isFetching: boolean;
  onCopy: (value: string) => void;
  onRefresh: () => void;
}): React.ReactElement {
  const t = useTranslations('emailForwarding');
  const locale = useLocale();

  return (
    <ol className='border-border divide-y border-t pt-6'>
      <SetupStep number={1} title={t('addAddressTitle')}>
        <p className='text-muted-foreground text-sm leading-relaxed'>{t('addAddressBody')}</p>
        <Button variant='outline' size='sm' asChild>
          <a href='https://mail.google.com/mail/' target='_blank' rel='noopener noreferrer'>
            {t('openGmail')} <ExternalLink aria-hidden='true' />
          </a>
        </Button>
      </SetupStep>

      <SetupStep number={2} title={t('verifyTitle')}>
        {route.confirmation_received_at ? (
          <div className='space-y-3'>
            <p className='text-muted-foreground text-sm leading-relaxed'>
              {t('verificationReceivedBody')}
            </p>
            {route.verification_text && (
              <div className='bg-muted/70 space-y-2 rounded-lg p-3'>
                <p className='text-xs font-medium'>{t('verificationMessage')}</p>
                <p className='text-sm break-words whitespace-pre-wrap select-all'>
                  {route.verification_text}
                </p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => onCopy(route.verification_text!)}>
                  {confirmationCopied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
                  {confirmationCopied ? t('copied') : t('copyConfirmation')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className='text-muted-foreground text-sm leading-relaxed'>
            {t('waitingForVerification')}
          </p>
        )}
        <Button variant='ghost' size='sm' onClick={onRefresh} disabled={isFetching}>
          <RefreshCw aria-hidden='true' /> {t('refreshStatus')}
        </Button>
      </SetupStep>

      <SetupStep number={3} title={t('createFilterTitle')}>
        <p className='text-muted-foreground text-sm leading-relaxed'>{t('createFilterBody')}</p>
        <p className='text-foreground text-sm font-medium'>{t('filteredOnly')}</p>
        <a
          className='text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline'
          href={`https://support.google.com/mail/answer/10957?hl=${locale === 'es' ? 'es-419' : 'en'}`}
          target='_blank'
          rel='noopener noreferrer'>
          {t('gmailInstructions')} <ExternalLink className='size-3' aria-hidden='true' />
        </a>
      </SetupStep>
    </ol>
  );
}
