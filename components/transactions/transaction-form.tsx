'use client';

import { useEffect, Fragment } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useCreateTransaction } from '@/lib/api/mutations/transaction.mutations';
import { useUpdateTransaction } from '@/lib/api/mutations/transaction.mutations';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import type { Transaction, Category } from '@/types';

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

  const colombiaTimes = getCurrentColombiaTimes();
  const isEditing = !!transaction;

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
      } else {
        await createMutation.mutateAsync({
          ...values,
          source: 'web',
          category_id: values.category_id ?? undefined,
          transfer_to_account_id: values.transfer_to_account_id ?? undefined,
        });
        toast.success('Transaction created');
      }
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error(isEditing ? 'Failed to update transaction' : 'Failed to create transaction');
    }
  }

  const filteredCategories = categories?.filter((c) => c.type === watchType) ?? [];
  const parentCategories = filteredCategories.filter((c) => !c.parent_id);
  const getChildren = (parentId: string): Category[] =>
    filteredCategories.filter((c) => c.parent_id === parentId);

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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select category' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {parentCategories.map((parent, idx) => {
                        const children = getChildren(parent.id);
                        if (children.length === 0) {
                          return (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.icon ? `${parent.icon} ` : ''}
                              {parent.name}
                            </SelectItem>
                          );
                        }
                        return (
                          <Fragment key={parent.id}>
                            {idx > 0 && <SelectSeparator />}
                            <SelectGroup>
                              <SelectLabel>
                                {parent.icon ? `${parent.icon} ` : ''}
                                {parent.name}
                              </SelectLabel>
                              <SelectItem value={parent.id} className='pl-4'>
                                All {parent.name}
                              </SelectItem>
                              {children.map((child) => (
                                <SelectItem key={child.id} value={child.id} className='pl-6'>
                                  {child.icon ? `${child.icon} ` : ''}
                                  {child.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </Fragment>
                        );
                      })}
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

            <div className='flex justify-end gap-3 pt-4'>
              <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type='submit' disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : isEditing
                    ? 'Update'
                    : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
