'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

const formSchema = z.object({
  email: z.email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type FormValues = z.infer<typeof formSchema>;

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const { signInWithPassword, signInWithGoogle, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function handleGoogleLogin(): Promise<void> {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      toast.error('Google sign-in failed');
    }
  }

  async function onSubmit(values: FormValues): Promise<void> {
    setError(null);
    try {
      await signInWithPassword(values.email, values.password);
      router.push('/dashboard');
    } catch {
      setError('Invalid email or password');
      toast.error('Login failed');
    }
  }

  return (
    <div className='bg-login-bg flex min-h-screen w-full items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='mb-8 text-center'>
          <div className='bg-primary mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl shadow-lg'>
            <span className='text-primary-foreground text-3xl font-bold'>$</span>
          </div>
          <h1 className='mb-2 text-4xl font-bold text-white'>Spends Assistant</h1>
          <p className='text-muted-foreground text-sm'>Sign in to manage your finances</p>
        </div>

        <div className='border-border bg-card/80 rounded-2xl border p-8 shadow-2xl backdrop-blur-sm'>
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
                    <FormLabel className='text-foreground'>Email</FormLabel>
                    <FormControl>
                      <Input
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
                    <FormLabel className='text-foreground'>Password</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder='Enter your password'
                        {...field}
                        disabled={isLoading}
                        className='border-border bg-background text-foreground placeholder:text-muted-foreground h-12'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type='submit'
                className='h-12 w-full cursor-pointer text-base'
                disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='border-border w-full border-t' />
                </div>
                <div className='relative flex justify-center text-xs uppercase'>
                  <span className='bg-card/80 text-muted-foreground px-2'>Or continue with</span>
                </div>
              </div>

              <Button
                type='button'
                variant='outline'
                className='border-border hover:bg-accent h-12 w-full cursor-pointer text-base'
                onClick={(): void => void handleGoogleLogin()}
                disabled={isLoading}>
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
                Google
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
