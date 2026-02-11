'use client';

import { useEffect, useState } from 'react';
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
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { useUpdateAccount, useDeleteAccount } from '@/lib/api/mutations/account.mutations';
import { useCreateTransaction } from '@/lib/api/mutations/transaction.mutations';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { formatCurrency } from '@/lib/utils/formatting';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
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

interface AccountEditDialogProps {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountEditDialog({
  account,
  open,
  onOpenChange,
}: AccountEditDialogProps): React.ReactElement {
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();
  const createTxMutation = useCreateTransaction();
  const { data: txResult } = useTransactions(account ? { account_id: account.id, limit: 1 } : {});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'none' | 'direct' | 'transaction'>('none');
  const [newBalance, setNewBalance] = useState('');
  const { openNew } = useTransactionFormStore();
  const txCount = txResult?.count ?? 0;

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
    if (account && open) {
      form.reset({
        name: account.name,
        type: account.type,
        institution: account.institution ?? '',
        last_four: account.last_four ?? '',
        currency: account.currency,
        color: account.color ?? '',
        icon: account.icon ?? '',
      });
      setAdjustMode('none');
      setNewBalance('');
    }
  }, [account, open, form]);

  const watchType = form.watch('type');
  const showLastFour = watchType === 'credit_card' || watchType === 'credit';

  async function onSubmit(values: FormValues): Promise<void> {
    if (!account) return;
    try {
      await updateMutation.mutateAsync({ id: account.id, ...values });
      toast.success('Account updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update account');
    }
  }

  async function handleDelete(): Promise<void> {
    if (!account) return;
    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success('Account deleted');
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error('Failed to delete account');
    }
  }

  async function handleDirectAdjust(): Promise<void> {
    if (!account) return;
    const target = parseFloat(newBalance);
    if (isNaN(target)) {
      toast.error('Enter a valid number');
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: account.id, balance: target });
      toast.success(`Balance set to ${formatCurrency(target, account.currency)}`);
      onOpenChange(false);
    } catch {
      toast.error('Failed to adjust balance');
    }
  }

  async function handleTransactionAdjust(): Promise<void> {
    if (!account) return;
    const target = parseFloat(newBalance);
    if (isNaN(target)) {
      toast.error('Enter a valid number');
      return;
    }
    const diff = target - account.balance;
    if (diff === 0) {
      toast.error('Balance is already at the target');
      return;
    }
    const times = getCurrentColombiaTimes();
    try {
      await createTxMutation.mutateAsync({
        date: times.date,
        time: times.time,
        amount: Math.abs(diff),
        description: 'Balance adjustment',
        account_id: account.id,
        type: diff > 0 ? 'income' : 'expense',
        source: 'web',
      });
      toast.success(
        `Adjustment transaction created (${diff > 0 ? '+' : ''}${formatCurrency(diff, account.currency)})`,
      );
      onOpenChange(false);
    } catch {
      toast.error('Failed to create adjustment');
    }
  }

  function handleOpenTransactionForm(): void {
    if (!account) return;
    onOpenChange(false);
    openNew();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[90vh] overflow-y-auto sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
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

            {/* Balance adjustment section */}
            {account && (
              <div className='border-border space-y-3 rounded-lg border p-3'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-medium'>Balance</p>
                    <p
                      className={`text-lg font-bold ${account.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                  </div>
                  {adjustMode === 'none' && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='cursor-pointer'
                      onClick={(): void => setAdjustMode('direct')}>
                      Adjust
                    </Button>
                  )}
                </div>

                {adjustMode !== 'none' && (
                  <div className='space-y-3'>
                    <div>
                      <label className='text-muted-foreground mb-1 block text-xs'>
                        New balance
                      </label>
                      <Input
                        type='number'
                        step='1'
                        value={newBalance}
                        onChange={(e): void => setNewBalance(e.target.value)}
                        placeholder={String(account.balance)}
                      />
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='cursor-pointer'
                        onClick={(): void => setAdjustMode('none')}>
                        Cancel
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        className='cursor-pointer'
                        disabled={updateMutation.isPending}
                        onClick={handleDirectAdjust}>
                        {updateMutation.isPending ? 'Saving...' : 'Set balance'}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        className='cursor-pointer'
                        disabled={createTxMutation.isPending}
                        onClick={handleTransactionAdjust}>
                        {createTxMutation.isPending ? 'Creating...' : 'With transaction'}
                      </Button>
                    </div>
                    <button
                      type='button'
                      className='text-muted-foreground hover:text-foreground cursor-pointer text-xs underline'
                      onClick={handleOpenTransactionForm}>
                      Or create a custom transaction
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className='flex justify-between gap-3 pt-4'>
              <Button
                type='button'
                variant='ghost'
                className='text-destructive cursor-pointer'
                onClick={(): void => setConfirmDeleteOpen(true)}>
                Delete
              </Button>
              <div className='flex gap-3'>
                <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type='submit' disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Update'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>

      {account && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title='Delete Account'
          description={
            <p className='text-muted-foreground text-sm'>
              This will permanently delete <strong>{account.name}</strong>
              {txCount > 0 && (
                <>
                  {' '}
                  and its <strong>{txCount}</strong> transaction{txCount !== 1 && 's'}
                </>
              )}
              . This action cannot be undone.
            </p>
          }
          confirmText={account.name}
          onConfirm={handleDelete}
          isPending={deleteMutation.isPending}
        />
      )}
    </Dialog>
  );
}
