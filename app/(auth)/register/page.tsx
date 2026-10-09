'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AnottoWordmark } from '@/components/layout/anotto-wordmark';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { TERMS_URL, PRIVACY_URL } from '@/lib/auth/legal-acceptance';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

const GoogleIcon = (): React.ReactElement => (
  <svg className='mr-2 h-5 w-5' viewBox='0 0 24 24'>
    <path
      d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z'
      fill='#4285F4'
    />
    <path
      d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
      fill='#34A853'
    />
    <path
      d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
      fill='#FBBC05'
    />
    <path
      d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
      fill='#EA4335'
    />
  </svg>
);

interface FormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage(): React.ReactElement {
  const a = useTranslations('auth');
  const legal = useTranslations('legalAcceptance');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const formSchema = z
    .object({
      email: z.email({ message: a('invalidEmail') }),
      password: z.string().min(6, { message: a('shortPassword') }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: a('passwordMismatch'),
      path: ['confirmPassword'],
    });

  const t = useTranslations('settings');
  const { signUp, signInWithGoogle, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setError(null);
    if (!acceptedTerms) return;
    try {
      await signUp(values.email, values.password);
      setSentEmail(values.email);
      setEmailSent(true);
    } catch {
      setError(a('createAccountFailed'));
      toast.error(a('signUpFailed'));
    }
  }

  async function handleGoogleSignUp(): Promise<void> {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      toast.error(a('googleSignUpFailed'));
    }
  }

  if (emailSent) {
    return (
      <div className='bg-login-bg flex min-h-screen w-full items-center justify-center p-4'>
        <div className='w-full max-w-md'>
          <div className='mb-8 text-center'>
            <AnottoWordmark className='mb-6 justify-center' />
          </div>

          <Card className='border-border bg-card'>
            <CardHeader className='text-center'>
              <div className='bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full'>
                <Mail className='text-primary h-8 w-8' />
              </div>
              <CardTitle className='text-xl'>{t('checkYourEmail')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-6 text-center'>
              <p className='text-muted-foreground text-sm'>
                {t('verificationSent', { email: sentEmail })}
              </p>
              <Button asChild variant='outline' className='w-full'>
                <Link href='/login'>{t('backToLogin')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-login-bg flex min-h-screen w-full items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='mb-8 text-center'>
          <AnottoWordmark className='mb-6 justify-center' />
          <h1 className='text-foreground mb-2 text-2xl font-semibold'>{a('signUp')}</h1>
          <p className='text-muted-foreground text-sm'>{a('signUpDescription')}</p>
        </div>

        <div className='border-border bg-card rounded-2xl border p-8'>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              {error && (
                <div className='bg-destructive/10 text-destructive rounded-lg p-3 text-sm'>
                  {error}
                </div>
              )}

              <FormField
                control={form.control}
                name='email'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel className='text-foreground'>{a('email')}</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        autoComplete='email'
                        placeholder='you@example.com'
                        {...field}
                        disabled={isLoading}
                        className='border-border bg-background text-foreground placeholder:text-muted-foreground h-12'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='password'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel className='text-foreground'>{a('password')}</FormLabel>
                    <div className='relative'>
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete='new-password'
                          placeholder={a('newPasswordPlaceholder')}
                          {...field}
                          disabled={isLoading}
                          className='border-border bg-background text-foreground placeholder:text-muted-foreground h-12 pr-14'
                        />
                      </FormControl>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute top-1/2 right-1 h-11 w-11 -translate-y-1/2 p-0'
                        onClick={(): void => setShowPassword((prev) => !prev)}
                        aria-label={a(showPassword ? 'hidePassword' : 'showPassword')}
                        aria-pressed={showPassword}>
                        {showPassword ? (
                          <EyeOff className='text-muted-foreground h-4 w-4' />
                        ) : (
                          <Eye className='text-muted-foreground h-4 w-4' />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel className='text-foreground'>{a('confirmPassword')}</FormLabel>
                    <div className='relative'>
                      <FormControl>
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete='new-password'
                          placeholder={a('confirmPasswordPlaceholder')}
                          {...field}
                          disabled={isLoading}
                          className='border-border bg-background text-foreground placeholder:text-muted-foreground h-12 pr-14'
                        />
                      </FormControl>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute top-1/2 right-1 h-11 w-11 -translate-y-1/2 p-0'
                        onClick={(): void => setShowConfirmPassword((prev) => !prev)}
                        aria-label={a(showConfirmPassword ? 'hidePassword' : 'showPassword')}
                        aria-pressed={showConfirmPassword}>
                        {showConfirmPassword ? (
                          <EyeOff className='text-muted-foreground h-4 w-4' />
                        ) : (
                          <Eye className='text-muted-foreground h-4 w-4' />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='space-y-3 text-sm'>
                <div className='flex flex-wrap gap-4'>
                  <a
                    href={TERMS_URL}
                    target='_blank'
                    rel='noreferrer'
                    className='text-brand underline'>
                    {legal('terms')}
                  </a>
                  <a
                    href={PRIVACY_URL}
                    target='_blank'
                    rel='noreferrer'
                    className='text-brand underline'>
                    {legal('privacy')}
                  </a>
                </div>
                <label className='flex min-h-11 cursor-pointer items-start gap-3'>
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(value): void => setAcceptedTerms(value === true)}
                  />
                  <span>{legal('checkbox')}</span>
                </label>
              </div>
              <Button
                type='submit'
                className='h-12 w-full cursor-pointer text-base'
                disabled={isLoading || !acceptedTerms}>
                {isLoading ? a('creatingAccount') : a('signUp')}
              </Button>

              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='border-border w-full border-t' />
                </div>
                <div className='relative flex justify-center text-xs uppercase'>
                  <span className='bg-card text-muted-foreground px-2'>{a('continueWith')}</span>
                </div>
              </div>

              <Button
                type='button'
                variant='outline'
                className='border-border hover:bg-accent h-12 w-full cursor-pointer text-base'
                onClick={(): void => void handleGoogleSignUp()}
                disabled={isLoading}>
                <GoogleIcon />
                Google
              </Button>

              <p className='text-muted-foreground text-center text-sm'>
                {a('hasAccount')}{' '}
                <Link href='/login' className='text-brand hover:underline'>
                  {a('signIn')}
                </Link>
              </p>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
