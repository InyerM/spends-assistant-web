'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EmailForwardingRoute } from '@/lib/api/queries/email-forwarding.queries';
import { EmailSenderGuide } from '@/components/settings/email-sender-guide';
import { googleVerificationUrl } from '@/lib/email-forwarding/google-verification';

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
  isConfirming,
  confirmationError,
  onCopy,
  onRefresh,
  onMarkVerified,
}: {
  route: ActiveRoute;
  confirmationCopied: boolean;
  isFetching: boolean;
  isConfirming: boolean;
  confirmationError: boolean;
  onCopy: (value: string) => void;
  onRefresh: () => void;
  onMarkVerified: () => void;
}): React.ReactElement {
  const t = useTranslations('emailForwarding');
  const locale = useLocale();
  const verificationUrl = googleVerificationUrl(route.verification_text);

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
              {route.user_confirmed_at ? t('verifiedBody') : t('verificationReceivedBody')}
            </p>
            {!route.user_confirmed_at && (
              <div className='flex flex-wrap items-center gap-2'>
                {verificationUrl && (
                  <Button size='sm' asChild>
                    <a href={verificationUrl} target='_blank' rel='noopener noreferrer'>
                      {t('openVerification')} <ExternalLink aria-hidden='true' />
                    </a>
                  </Button>
                )}
                <Button
                  variant='outline'
                  size='sm'
                  disabled={isConfirming}
                  onClick={onMarkVerified}>
                  <Check aria-hidden='true' /> {t('markVerified')}
                </Button>
              </div>
            )}
            {confirmationError && (
              <p className='text-destructive text-sm' role='alert'>
                {t('markVerifiedError')}
              </p>
            )}
            {route.verification_text && (
              <details className='border-border rounded-lg border p-3'>
                <summary className='cursor-pointer text-sm font-medium'>
                  {t('showOriginalMessage')}
                </summary>
                <div className='space-y-3 pt-3'>
                  <p className='bg-muted/60 max-h-48 overflow-y-auto rounded-md p-3 text-xs leading-relaxed break-all whitespace-pre-wrap select-all'>
                    {route.verification_text}
                  </p>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onCopy(route.verification_text!)}>
                    {confirmationCopied ? (
                      <Check aria-hidden='true' />
                    ) : (
                      <Copy aria-hidden='true' />
                    )}
                    {confirmationCopied ? t('copied') : t('copyConfirmation')}
                  </Button>
                </div>
              </details>
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
        {route.user_confirmed_at ? (
          <div className='space-y-4'>
            <p className='text-foreground text-sm font-medium'>{t('filterCreatedInGmail')}</p>
            <ol className='text-muted-foreground list-inside list-decimal space-y-2 text-sm leading-relaxed'>
              <li>{t('filterStepFindSender')}</li>
              <li>{t('filterStepOpenOptions')}</li>
              <li>{t('filterStepChooseForwarding')}</li>
              <li>{t('filterStepFinish')}</li>
            </ol>
            <p className='text-muted-foreground text-sm leading-relaxed'>{t('filteredOnly')}</p>
            <EmailSenderGuide />
          </div>
        ) : (
          <p className='text-muted-foreground text-sm leading-relaxed'>{t('filterLocked')}</p>
        )}
        <a
          className='text-brand inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline'
          href={`https://support.google.com/mail/answer/10957?hl=${locale === 'es' ? 'es-419' : 'en'}`}
          target='_blank'
          rel='noopener noreferrer'>
          {t('gmailInstructions')} <ExternalLink className='size-3' aria-hidden='true' />
        </a>
      </SetupStep>

      <SetupStep number={4} title={t('reviewInboxTitle')}>
        <p className='text-muted-foreground text-sm leading-relaxed'>{t('reviewInboxBody')}</p>
        <Button variant='outline' size='sm' asChild>
          <Link href='/transactions/shortcut-inbox'>
            <Inbox aria-hidden='true' /> {t('reviewInbox')}
          </Link>
        </Button>
      </SetupStep>
    </ol>
  );
}
