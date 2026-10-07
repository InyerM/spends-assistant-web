'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
import { Label } from '@/components/ui/label';
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
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { buildBalanceAdjustment } from '@/lib/accounts/adjustment';
import { formatCurrency } from '@/lib/utils/formatting';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import { ACCOUNT_TYPES } from '@/lib/utils/account-translations';
import { AccountIdentifierEditor } from './account-identifier-editor';
import { accountIdentifiers, primarySuffix } from '@/lib/accounts/identifiers';
import type { Account } from '@/types';
import type { AccountIdentifier } from '@/types/account';

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
  const locale = useLocale();
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();
  const createTxMutation = useCreateTransaction();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'none' | 'transaction'>('none');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [balanceSign, setBalanceSign] = useState<'+' | '-'>('+');
  const [identifiers, setIdentifiers] = useState<AccountIdentifier[]>([]);
  const { openNew } = useTransactionFormStore();

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
      if (account) setIdentifiers(accountIdentifiers(account));
      setAdjustMode('none');
      setAdjustmentAmount('');
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
  }, [account?.id, open, form]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally using primitive dep

  async function onSubmit(values: FormValues): Promise<void> {
    if (!account) return;
    try {
      const payload = {
        name: values.name,
        type: values.type,
        institution: values.institution,
        last_four: primarySuffix({ type: values.type, last_four: null, identifiers }),
        identifiers,
        color: values.color,
        icon: values.icon,
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

  async function handleTransactionAdjust(): Promise<void> {
    if (!account) return;
    const adjustment = buildBalanceAdjustment(adjustmentAmount, balanceSign);
    if (!adjustment) {
      toast.error(t('enterValidNumber'));
      return;
    }
    const times = getCurrentColombiaTimes();
    try {
      await createTxMutation.mutateAsync({
        date: times.date,
        time: times.time,
        amount: adjustment.amount,
        description: t('balanceAdjustment'),
        account_id: account.id,
        type: adjustment.type,
        source: 'web',
      });
      toast.success(
        t('adjustmentCreated', {
          amount: `${balanceSign}${formatCurrency(adjustment.amount, account.currency, locale)}`,
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
                      {ACCOUNT_TYPES.map((at) => (
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
            <AccountIdentifierEditor value={identifiers} onChange={setIdentifiers} />
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
                      className={`text-lg font-semibold tabular-nums ${account.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(account.balance, account.currency, locale)}
                    </p>
                  </div>
                  {adjustMode === 'none' && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='cursor-pointer'
                      onClick={(): void => setAdjustMode('transaction')}>
                      {t('adjust')}
                    </Button>
                  )}
                </div>

                {adjustMode !== 'none' && (
                  <div className='space-y-3'>
                    <div>
                      <Label className='text-muted-foreground mb-1 block text-xs'>
                        {t('adjustmentAmount')}
                      </Label>
                      <div className='flex min-w-0 gap-2'>
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
                          value={adjustmentAmount}
                          onChange={(e): void => setAdjustmentAmount(e.target.value)}
                          placeholder='0'
                          className='h-14 min-w-0 text-2xl font-semibold sm:h-11 sm:text-base sm:font-normal'
                        />
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-2'>
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
                        disabled={createTxMutation.isPending}
                        onClick={handleTransactionAdjust}>
                        {createTxMutation.isPending ? tCommon('creating') : t('withTransaction')}
                      </Button>
                    </div>
                    <Button
                      type='button'
                      variant='link'
                      size='sm'
                      className='text-muted-foreground hover:text-foreground h-auto cursor-pointer p-0 text-xs'
                      onClick={handleOpenTransactionForm}>
                      {t('orCreateCustomTransaction')}
                    </Button>
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
