'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
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

const accountTypes: { value: AccountType; labelKey: string }[] = [
  { value: 'checking', labelKey: 'checking' },
  { value: 'savings', labelKey: 'savings' },
  { value: 'credit_card', labelKey: 'creditCard' },
  { value: 'cash', labelKey: 'cash' },
  { value: 'investment', labelKey: 'investment' },
  { value: 'crypto', labelKey: 'crypto' },
  { value: 'credit', labelKey: 'credit' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'credit']),
  institution: z.string().optional(),
  last_four: z
    .string()
    .regex(/^\d{4}$/, 'Must be exactly 4 digits')
    .or(z.literal(''))
    .optional(),
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
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();
  const createTxMutation = useCreateTransaction();
  const { data: txResult } = useTransactions(account ? { account_id: account.id, limit: 1 } : {});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'none' | 'direct' | 'transaction'>('none');
  const [newBalance, setNewBalance] = useState('');
  const [balanceSign, setBalanceSign] = useState<'+' | '-'>('+');
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

  // Reset local state when dialog opens (set state during render pattern)
  const [prevOpenAccountId, setPrevOpenAccountId] = useState<string | null>(null);
  const openAccountId = open && account ? account.id : null;
  if (openAccountId !== prevOpenAccountId) {
    setPrevOpenAccountId(openAccountId);
    if (openAccountId) {
      setAdjustMode('none');
      setNewBalance('');
      setBalanceSign('+');
    }
  }

  // Reset form values when dialog opens
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
    }
  }, [account, open, form]);

  async function onSubmit(values: FormValues): Promise<void> {
    if (!account) return;
    try {
      const payload = {
        ...values,
        last_four: values.last_four?.trim() || null,
      };
      await updateMutation.mutateAsync({ id: account.id, ...payload });
      toast.success(t('accountUpdated'));
      onOpenChange(false);
    } catch {
      toast.error(t('failedToUpdate'));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!account) return;
    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success(t('accountDeleted'));
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error(t('failedToDelete'));
    }
  }

  function getSignedBalance(): number {
    const raw = parseFloat(newBalance);
    if (isNaN(raw)) return NaN;
    return balanceSign === '-' ? -Math.abs(raw) : Math.abs(raw);
  }

  async function handleDirectAdjust(): Promise<void> {
    if (!account) return;
    const target = getSignedBalance();
    if (isNaN(target)) {
      toast.error(t('enterValidNumber'));
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: account.id, balance: target });
      toast.success(t('balanceSetTo', { balance: formatCurrency(target, account.currency) }));
      onOpenChange(false);
    } catch {
      toast.error(t('failedToAdjust'));
    }
  }

  async function handleTransactionAdjust(): Promise<void> {
    if (!account) return;
    const target = getSignedBalance();
    if (isNaN(target)) {
      toast.error(t('enterValidNumber'));
      return;
    }
    const diff = target - account.balance;
    if (diff === 0) {
      toast.error(t('balanceAlreadyAtTarget'));
      return;
    }
    const times = getCurrentColombiaTimes();
    try {
      await createTxMutation.mutateAsync({
        date: times.date,
        time: times.time,
        amount: Math.abs(diff),
        description: t('balanceAdjustment'),
        account_id: account.id,
        type: diff > 0 ? 'income' : 'expense',
        source: 'web',
      });
      toast.success(
        t('adjustmentCreated', {
          amount: `${diff > 0 ? '+' : ''}${formatCurrency(diff, account.currency)}`,
        }),
      );
      onOpenChange(false);
    } catch {
      toast.error(t('failedToCreateAdjustment'));
    }
  }

  function handleOpenTransactionForm(): void {
    if (!account) return;
    onOpenChange(false);
    openNew();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{t('editAccount')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('namePlaceholder')} {...field} />
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
                  <FormLabel>{t('type')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('type')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accountTypes.map((at) => (
                        <SelectItem key={at.value} value={at.value}>
                          {t(at.labelKey)}
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
                  <FormLabel>{t('institution')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('institutionPlaceholder')} {...field} />
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
                  <FormLabel>{t('lastFour')}</FormLabel>
                  <FormControl>
                    <Input placeholder='1234' maxLength={4} inputMode='numeric' {...field} />
                  </FormControl>
                  <FormDescription>{t('lastFourDescription')}</FormDescription>
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
                    <FormLabel>{t('icon')}</FormLabel>
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
                    <FormLabel>{t('color')}</FormLabel>
                    <FormControl>
                      <ColorPicker value={field.value ?? ''} onChange={field.onChange} />
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
                    <p className='text-sm font-medium'>{t('balance')}</p>
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
                      {t('adjust')}
                    </Button>
                  )}
                </div>

                {adjustMode !== 'none' && (
                  <div className='space-y-3'>
                    <div>
                      <label className='text-muted-foreground mb-1 block text-xs'>
                        {t('newBalance')}
                      </label>
                      <div className='flex gap-2'>
                        <Button
                          type='button'
                          variant='outline'
                          className={`h-14 w-14 shrink-0 cursor-pointer text-xl font-bold sm:h-11 sm:w-11 sm:text-base ${
                            balanceSign === '+'
                              ? 'border-success text-success'
                              : 'border-destructive text-destructive'
                          }`}
                          onClick={(): void => setBalanceSign((s) => (s === '+' ? '-' : '+'))}>
                          {balanceSign}
                        </Button>
                        <Input
                          type='number'
                          inputMode='numeric'
                          step='1'
                          value={newBalance}
                          onChange={(e): void => setNewBalance(e.target.value)}
                          placeholder={String(Math.abs(account.balance))}
                          className='h-14 text-2xl font-semibold sm:h-11 sm:text-base sm:font-normal'
                        />
                      </div>
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='cursor-pointer'
                        onClick={(): void => setAdjustMode('none')}>
                        {tCommon('cancel')}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        className='cursor-pointer'
                        disabled={updateMutation.isPending}
                        onClick={handleDirectAdjust}>
                        {updateMutation.isPending ? tCommon('saving') : t('setBalance')}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        className='cursor-pointer'
                        disabled={createTxMutation.isPending}
                        onClick={handleTransactionAdjust}>
                        {createTxMutation.isPending ? tCommon('creating') : t('withTransaction')}
                      </Button>
                    </div>
                    <button
                      type='button'
                      className='text-muted-foreground hover:text-foreground cursor-pointer text-xs underline'
                      onClick={handleOpenTransactionForm}>
                      {t('orCreateCustomTransaction')}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className='flex justify-between gap-3 pt-4'>
              {!account?.is_default && (
                <Button
                  type='button'
                  variant='ghost'
                  className='text-destructive cursor-pointer'
                  onClick={(): void => setConfirmDeleteOpen(true)}>
                  {tCommon('delete')}
                </Button>
              )}
              {account?.is_default && <div />}
              <div className='flex gap-3'>
                <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button type='submit' disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? tCommon('saving') : tCommon('update')}
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
          title={t('deleteAccount')}
          description={
            <p className='text-muted-foreground text-sm'>
              {t('deleteAccountConfirm', {
                name: account.name,
                txInfo: txCount > 0 ? t('andTransactions', { count: txCount }) : '',
              })}
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
