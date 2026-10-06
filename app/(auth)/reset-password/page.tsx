'use client';

import { useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AnottoWordmark } from '@/components/layout/anotto-wordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

export default function ResetPasswordPage(): React.ReactElement {
  const a = useTranslations('auth');
  const { completePasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<'mismatch' | 'short' | 'expired' | null>(null);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (password.length < 8) {
      setError('short');
      return;
    }
    if (password !== confirmation) {
      setError('mismatch');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await completePasswordReset(password);
      setComplete(true);
    } catch {
      setError('expired');
    } finally {
      setIsSubmitting(false);
    }
  }

  const errorText =
    error === 'mismatch'
      ? a('passwordMismatch')
      : error === 'short'
        ? a('recoveryPasswordMinLength')
        : error === 'expired'
          ? a('recoveryLinkExpired')
          : null;

  return (
    <main className='w-full max-w-md p-4'>
      <AnottoWordmark className='mb-6 justify-center' />
      <div className='border-border bg-card space-y-5 rounded-2xl border p-8'>
        <div>
          <h1 className='text-foreground text-xl font-semibold'>{a('resetPasswordTitle')}</h1>
          <p className='text-muted-foreground mt-2 text-sm'>{a('resetPasswordDescription')}</p>
        </div>
        {complete ? (
          <p role='status' className='text-foreground text-sm'>
            {a('recoveryComplete')}
          </p>
        ) : (
          <form onSubmit={(event): void => void submit(event)} className='space-y-4'>
            <div className='space-y-2'>
              <label htmlFor='recovery-password' className='text-foreground text-sm font-medium'>
                {a('recoveryNewPassword')}
              </label>
              <Input
                id='recovery-password'
                type='password'
                autoComplete='new-password'
                required
                value={password}
                onChange={(event): void => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className='space-y-2'>
              <label
                htmlFor='recovery-confirmation'
                className='text-foreground text-sm font-medium'>
                {a('confirmPassword')}
              </label>
              <Input
                id='recovery-confirmation'
                type='password'
                autoComplete='new-password'
                required
                value={confirmation}
                onChange={(event): void => setConfirmation(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {errorText ? (
              <p role='alert' className='text-destructive text-sm'>
                {errorText}
              </p>
            ) : null}
            <Button type='submit' className='w-full' disabled={isSubmitting}>
              {a('saveRecoveredPassword')}
            </Button>
          </form>
        )}
        <Link
          href={complete ? '/login' : '/forgot-password'}
          className='text-brand block text-center text-sm hover:underline'>
          {a(complete ? 'signIn' : 'requestNewRecoveryLink')}
        </Link>
      </div>
    </main>
  );
}
