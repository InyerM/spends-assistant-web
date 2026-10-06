'use client';

import { useState, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AnottoWordmark } from '@/components/layout/anotto-wordmark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

export default function ForgotPasswordPage(): React.ReactElement {
  const a = useTranslations('auth');
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError(false);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className='w-full max-w-md p-4'>
      <AnottoWordmark className='mb-6 justify-center' />
      <div className='border-border bg-card space-y-5 rounded-2xl border p-8'>
        <div>
          <h1 className='text-foreground text-xl font-semibold'>{a('recoveryTitle')}</h1>
          <p className='text-muted-foreground mt-2 text-sm'>{a('recoveryDescription')}</p>
        </div>
        {sent ? (
          <p role='status' className='text-foreground text-sm'>
            {a('recoverySent')}
          </p>
        ) : (
          <form onSubmit={(event): void => void submit(event)} className='space-y-4'>
            <div className='space-y-2'>
              <label htmlFor='recovery-email' className='text-foreground text-sm font-medium'>
                {a('email')}
              </label>
              <Input
                id='recovery-email'
                type='email'
                autoComplete='email'
                required
                value={email}
                onChange={(event): void => setEmail(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {error ? (
              <p role='alert' className='text-destructive text-sm'>
                {a('recoverySendFailed')}
              </p>
            ) : null}
            <Button type='submit' className='w-full' disabled={isSubmitting}>
              {a('sendRecoveryLink')}
            </Button>
          </form>
        )}
        <Link href='/login' className='text-brand block text-center text-sm hover:underline'>
          {a('backToSignIn')}
        </Link>
      </div>
    </main>
  );
}
