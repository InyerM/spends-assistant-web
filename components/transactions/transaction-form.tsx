'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategorySelectItems } from '@/components/shared/category-select-items';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '@/lib/api/mutations/transaction.mutations';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import type { Transaction } from '@/types';

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
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const addAnotherRef = useRef(false);

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
        toast.success('Transaction updated');
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
        toast.success('Transaction created');
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
    } catch {
      toast.error(isEditing ? 'Failed to update transaction' : 'Failed to create transaction');
    }
  }

  async function handleDelete(): Promise<void> {
    if (!transaction) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
      toast.success('Transaction deleted');
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error('Failed to delete transaction');
    }
  }

  const allCategories = categories ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[90vh] overflow-y-auto sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Transaction' : 'New Transaction'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='date'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} />
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
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type='time' step='1' {...field} />
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
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select type' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='expense'>Expense</SelectItem>
                      <SelectItem value='income'>Income</SelectItem>
                      <SelectItem value='transfer'>Transfer</SelectItem>
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
                  <FormLabel>Amount (COP)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder='What was this for?' {...field} />
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
                  <FormLabel>Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select account' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts?.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.icon ?? '💳'} {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <FormLabel>Transfer To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select destination account' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts?.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.icon ?? '💳'} {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select category' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <CategorySelectItems categories={allCategories} filterType={watchType} />
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='notes'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder='Optional notes...' {...field} />
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
                  Delete
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
                  <span className='text-muted-foreground text-sm'>Add another</span>
                </label>
              )}
              <div className='flex gap-3'>
                <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type='submit'
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : isEditing
                      ? 'Update'
                      : 'Create'}
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
          title='Delete Transaction'
          description={
            <p className='text-muted-foreground text-sm'>This action cannot be undone.</p>
          }
          confirmText='Delete Transaction'
          onConfirm={handleDelete}
          isPending={deleteMutation.isPending}
        />
      )}
    </Dialog>
  );
}
