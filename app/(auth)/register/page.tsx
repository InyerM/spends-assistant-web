'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

const formSchema = z
  .object({
    email: z.email({ message: 'Please enter a valid email address' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof formSchema>;

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

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
    try {
      await signUp(values.email, values.password);
      router.push('/dashboard');
    } catch {
      setError('Failed to create account. Please try again.');
      toast.error('Sign up failed');
    }
  }

  return (
    <div className='bg-login-bg flex min-h-screen w-full items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='mb-8 text-center'>
          <div className='bg-primary mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl shadow-lg'>
            <span className='text-primary-foreground text-3xl font-bold'>$</span>
          </div>
          <h1 className='mb-2 text-4xl font-bold text-white'>Create Account</h1>
          <p className='text-muted-foreground text-sm'>Sign up to start managing your finances</p>
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
                        placeholder='At least 6 characters'
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
                name='confirmPassword'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel className='text-foreground'>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder='Confirm your password'
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
                {isLoading ? 'Creating account...' : 'Sign Up'}
              </Button>

              <p className='text-muted-foreground text-center text-sm'>
                Already have an account?{' '}
                <Link href='/login' className='text-primary hover:underline'>
                  Sign in
                </Link>
              </p>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
