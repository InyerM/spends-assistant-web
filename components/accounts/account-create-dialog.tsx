'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateAccount } from '@/lib/api/mutations/account.mutations';
import type { AccountType } from '@/types';

const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'credit', label: 'Credit' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'credit']),
  institution: z.string().optional(),
  last_four: z.string().max(4).optional(),
  currency: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AccountCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountCreateDialog({
  open,
  onOpenChange,
}: AccountCreateDialogProps): React.ReactElement {
  const createMutation = useCreateAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'checking',
      institution: '',
      last_four: '',
      currency: 'COP',
      color: '',
      icon: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        type: 'checking',
        institution: '',
        last_four: '',
        currency: 'COP',
        color: '',
        icon: '',
      });
    }
  }, [open, form]);

  const watchType = form.watch('type');
  const showLastFour = watchType === 'credit_card' || watchType === 'credit';

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Account created');
      onOpenChange(false);
    } catch {
      toast.error('Failed to create account');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>New Account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Account name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='type'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accountTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='institution'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>Institution</FormLabel>
                  <FormControl>
                    <Input placeholder='e.g. Bancolombia' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showLastFour && (
              <FormField
                control={form.control}
                name='last_four'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>Last 4 Digits</FormLabel>
                    <FormControl>
                      <Input placeholder='1234' maxLength={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='icon'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <Input placeholder='💳' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='color'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input type='color' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className='flex justify-end gap-3 pt-4'>
              <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
