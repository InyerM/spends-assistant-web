'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { useAcceptCurrentTerms } from '@/lib/api/mutations/legal-acceptance.mutations';
import { needsTermsAcceptance, PRIVACY_URL, TERMS_URL } from '@/lib/auth/legal-acceptance';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function TermsAcceptanceGate({ children }: { children: React.ReactNode }): React.ReactNode {
  const { user, signOut } = useAuth();
  const t = useTranslations('legalAcceptance');
  const mutation = useAcceptCurrentTerms();
  const [accepted, setAccepted] = useState(false);
  if (!user || !needsTermsAcceptance(user)) return children;
  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event): void => event.preventDefault()}
        onInteractOutside={(event): void => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <nav className='flex flex-wrap gap-4 text-sm' aria-label={t('documents')}>
          <a
            className='text-brand underline underline-offset-4'
            href={TERMS_URL}
            target='_blank'
            rel='noreferrer'>
            {t('terms')}
          </a>
          <a
            className='text-brand underline underline-offset-4'
            href={PRIVACY_URL}
            target='_blank'
            rel='noreferrer'>
            {t('privacy')}
          </a>
        </nav>
        <label className='flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm'>
          <Checkbox
            checked={accepted}
            onCheckedChange={(value): void => setAccepted(value === true)}
          />
          <span>{t('checkbox')}</span>
        </label>
        {mutation.isError && (
          <p role='alert' className='text-destructive text-sm'>
            {t('error')}
          </p>
        )}
        <Button disabled={!accepted || mutation.isPending} onClick={(): void => mutation.mutate()}>
          {t(mutation.isPending ? 'saving' : 'continue')}
        </Button>
        <Button
          variant='ghost'
          disabled={mutation.isPending}
          onClick={(): void => {
            void signOut();
          }}>
          {t('signOut')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
