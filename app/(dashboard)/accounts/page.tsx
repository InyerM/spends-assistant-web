'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCreateAccount, useUpdateAccount } from '@/lib/api/mutations/account.mutations';
import { formatCurrency } from '@/lib/utils/formatting';
import { Plus, Pencil } from 'lucide-react';
import type { Account, AccountType } from '@/types';

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

export default function AccountsPage(): React.ReactElement {
  const { data: accounts, isLoading } = useAccounts();
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

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

  const handleEdit = (account: Account): void => {
    setEditingAccount(account);
    form.reset({
      name: account.name,
      type: account.type,
      institution: account.institution ?? '',
      last_four: account.last_four ?? '',
      currency: account.currency,
      color: account.color ?? '',
      icon: account.icon ?? '',
    });
    setDialogOpen(true);
  };

  const handleCreate = (): void => {
    setEditingAccount(null);
    form.reset({
      name: '',
      type: 'checking',
      institution: '',
      last_four: '',
      currency: 'COP',
      color: '',
      icon: '',
    });
    setDialogOpen(true);
  };

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      if (editingAccount) {
        await updateMutation.mutateAsync({ id: editingAccount.id, ...values });
        toast.success('Account updated');
      } else {
        await createMutation.mutateAsync(values);
        toast.success('Account created');
      }
      setDialogOpen(false);
    } catch {
      toast.error(editingAccount ? 'Failed to update account' : 'Failed to create account');
    }
  }

  return (
    <div className='space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-foreground text-2xl font-bold'>Accounts</h2>
          <p className='text-muted-foreground text-sm'>Manage your financial accounts</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className='mr-2 h-4 w-4' />
          New Account
        </Button>
      </div>

      {isLoading ? (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className='border-border bg-card'>
              <CardHeader>
                <Skeleton className='h-5 w-32' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-8 w-40' />
                <Skeleton className='mt-2 h-4 w-24' />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {accounts?.map((account) => (
            <Card key={account.id} className='border-border bg-card'>
              <CardHeader className='flex flex-row items-center justify-between space-y-0'>
                <CardTitle className='text-base font-medium'>
                  {account.icon ?? '💳'} {account.name}
                </CardTitle>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={(): void => handleEdit(account)}
                  className='h-8 w-8 p-0'>
                  <Pencil className='h-4 w-4' />
                </Button>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${account.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(account.balance, account.currency)}
                </div>
                <div className='text-muted-foreground mt-2 flex items-center gap-2 text-sm'>
                  <span className='capitalize'>{account.type.replace('_', ' ')}</span>
                  {account.institution && <span>· {account.institution}</span>}
                  {account.last_four && <span>· •••• {account.last_four}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='border-border bg-card sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
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
                <Button type='button' variant='outline' onClick={(): void => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type='submit'
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingAccount
                      ? 'Update'
                      : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
