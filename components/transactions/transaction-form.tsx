'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { Sparkles, AlertTriangle } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useResolveDuplicate,
  DuplicateError,
} from '@/lib/api/mutations/transaction.mutations';
import { DuplicateWarningDialog } from '@/components/transactions/duplicate-warning-dialog';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { UsageIndicator } from '@/components/shared/usage-indicator';
import { useUsage } from '@/hooks/use-usage';
import { useSubscription } from '@/hooks/use-subscription';
import type { Transaction, CreateTransactionInput } from '@/types';

const formSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
  type: z.enum(['expense', 'income', 'transfer']),
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  transfer_to_account_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
}: TransactionFormProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: usage } = useUsage();
  const { data: subscription } = useSubscription();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const resolveDuplicate = useResolveDuplicate();
  const { openAi } = useTransactionFormStore();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const addAnotherRef = useRef(false);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    match: Transaction;
    input: CreateTransactionInput;
  } | null>(null);

  const colombiaTimes = getCurrentColombiaTimes();
  const isEditing = !!transaction?.id;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: transaction
      ? {
          date: transaction.date,
          time: transaction.time,
          amount: transaction.amount,
          description: transaction.description,
          notes: transaction.notes ?? '',
          type: transaction.type,
          account_id: transaction.account_id,
          category_id: transaction.category_id ?? undefined,
          transfer_to_account_id: transaction.transfer_to_account_id ?? undefined,
        }
      : {
          date: colombiaTimes.date,
          time: colombiaTimes.time,
          amount: 0,
          description: '',
          notes: '',
          type: 'expense' as const,
          account_id: '',
          category_id: undefined,
          transfer_to_account_id: undefined,
        },
  });

  useEffect(() => {
    if (open && transaction) {
      form.reset({
        date: transaction.date,
        time: transaction.time,
        amount: transaction.amount,
        description: transaction.description,
        notes: transaction.notes ?? '',
        type: transaction.type,
        account_id: transaction.account_id,
        category_id: transaction.category_id ?? undefined,
        transfer_to_account_id: transaction.transfer_to_account_id ?? undefined,
      });
    } else if (open && !transaction) {
      const times = getCurrentColombiaTimes();
      form.reset({
        date: times.date,
        time: times.time,
        amount: 0,
        description: '',
        notes: '',
        type: 'expense',
        account_id: '',
        category_id: undefined,
        transfer_to_account_id: undefined,
      });
    }
  }, [open, transaction, form]);

  const watchType = form.watch('type');

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: transaction.id,
          ...values,
          source: transaction.source,
          category_id: values.category_id ?? undefined,
          transfer_to_account_id: values.transfer_to_account_id ?? undefined,
        });
        toast.success(t('transactionUpdated'));
        onOpenChange(false);
      } else {
        const aiSource = transaction?.source === 'web-ai' ? transaction : null;
        await createMutation.mutateAsync({
          ...values,
          source: aiSource ? 'web-ai' : 'web',
          category_id: values.category_id ?? undefined,
          transfer_to_account_id: values.transfer_to_account_id ?? undefined,
          ...(aiSource
            ? {
                raw_text: aiSource.raw_text ?? undefined,
                confidence: aiSource.confidence ?? undefined,
                parsed_data: aiSource.parsed_data ?? undefined,
              }
            : {}),
        });
        toast.success(t('transactionCreated'));
        if (addAnotherRef.current) {
          const times = getCurrentColombiaTimes();
          form.reset({
            date: times.date,
            time: times.time,
            amount: 0,
            description: '',
            notes: '',
            type: values.type,
            account_id: values.account_id,
            category_id: values.category_id,
            transfer_to_account_id: undefined,
          });
          return;
        }
        onOpenChange(false);
      }
      form.reset();
    } catch (err) {
      if (err instanceof DuplicateError) {
        setDuplicateConflict({ match: err.match, input: err.input });
        return;
      }
      toast.error(isEditing ? t('failedToUpdate') : t('failedToCreate'));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!transaction) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
      toast.success(t('transactionDeleted'));
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error(t('failedToDelete'));
    }
  }

  const allCategories = categories ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editTransaction') : t('newTransaction')}</DialogTitle>
        </DialogHeader>

        {!isEditing && subscription?.plan !== 'pro' && usage && (
          <UsageIndicator usage={usage} showTransactions />
        )}

        {isEditing && transaction.duplicate_status === 'pending_review' && (
          <div className='border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border p-3'>
            <AlertTriangle className='text-warning mt-0.5 h-4 w-4 shrink-0' />
            <div className='flex-1'>
              <p className='text-sm font-medium'>{t('duplicateWarning')}</p>
              <p className='text-muted-foreground text-xs'>{t('duplicateFlagged')}</p>
              <div className='mt-2 flex gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={resolveDuplicate.isPending}
                  onClick={(): void => {
                    resolveDuplicate.mutate(
                      { id: transaction.id, action: 'keep' },
                      {
                        onSuccess: () => {
                          toast.success(t('markedAsNotDuplicate'));
                          onOpenChange(false);
                        },
                      },
                    );
                  }}>
                  {t('keepBoth')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='text-destructive'
                  disabled={resolveDuplicate.isPending}
                  onClick={(): void => {
                    resolveDuplicate.mutate(
                      { id: transaction.id, action: 'delete' },
                      {
                        onSuccess: () => {
                          toast.success(t('duplicateDeleted'));
                          onOpenChange(false);
                        },
                      },
                    );
                  }}>
                  {t('deleteThisOne')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isEditing && !transaction && (
          <button
            type='button'
            className='ai-gradient-btn flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-purple-500/50 px-3 py-2 text-sm text-purple-400 transition-colors hover:border-purple-400 hover:text-purple-300'
            onClick={openAi}>
            <Sparkles className='h-4 w-4' />
            {t('orCreateWithAi')}
          </button>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='date'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>{t('date')}</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='time'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>{t('time')}</FormLabel>
                    <FormControl>
                      <TimePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='type'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('type')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectType')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='expense'>{t('expense')}</SelectItem>
                      <SelectItem value='income'>{t('income')}</SelectItem>
                      <SelectItem value='transfer'>{t('transfer')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='amount'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('amountCop')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      inputMode='numeric'
                      step='1'
                      min='0'
                      placeholder='0'
                      {...field}
                      onChange={(e): void => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('descriptionPlaceholder')}
                      rows={2}
                      className='resize-none sm:min-h-9 sm:py-1'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='account_id'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('account')}</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('selectAccount')}
                      searchPlaceholder={t('searchAccounts')}
                      items={buildAccountItems(accounts ?? [])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchType === 'transfer' && (
              <FormField
                control={form.control}
                name='transfer_to_account_id'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>{t('transferTo')}</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={t('selectDestAccount')}
                        searchPlaceholder={t('searchAccounts')}
                        items={buildAccountItems(accounts ?? [])}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='category_id'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('category')}</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('selectCategory')}
                      searchPlaceholder={t('searchCategories')}
                      items={buildCategoryItems(allCategories, watchType)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='notes'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('notes')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('notesPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={`flex ${isEditing ? 'justify-between' : 'justify-end'} gap-3 pt-4`}>
              {isEditing && (
                <Button
                  type='button'
                  variant='ghost'
                  className='text-destructive cursor-pointer'
                  onClick={(): void => setConfirmDeleteOpen(true)}>
                  {tCommon('delete')}
                </Button>
              )}
              {!isEditing && (
                <label className='flex flex-1 items-center gap-2'>
                  <Checkbox
                    checked={addAnother}
                    onCheckedChange={(checked): void => {
                      const val = checked === true;
                      setAddAnother(val);
                      addAnotherRef.current = val;
                    }}
                  />
                  <span className='text-muted-foreground text-sm'>{t('addAnother')}</span>
                </label>
              )}
              <div className='flex gap-3'>
                <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  type='submit'
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? tCommon('saving')
                    : isEditing
                      ? tCommon('update')
                      : tCommon('create')}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>

      {isEditing && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title={t('deleteTransaction')}
          description={
            <p className='text-muted-foreground text-sm'>{tCommon('actionCannotBeUndone')}</p>
          }
          confirmText={t('deleteTransaction')}
          onConfirm={handleDelete}
          isPending={deleteMutation.isPending}
        />
      )}

      {duplicateConflict && (
        <DuplicateWarningDialog
          open={!!duplicateConflict}
          onOpenChange={(o): void => {
            if (!o) setDuplicateConflict(null);
          }}
          existingTransaction={duplicateConflict.match}
          newInput={duplicateConflict.input}
          onResolved={(): void => {
            setDuplicateConflict(null);
            onOpenChange(false);
            form.reset();
          }}
        />
      )}
    </Dialog>
  );
}
