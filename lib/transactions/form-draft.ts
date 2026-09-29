import { z } from 'zod';
import type { Category, TransactionType, UpdateTransactionInput } from '@/types';

const baseSchema = z.object({
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

export type TransactionFormValues = z.infer<typeof baseSchema>;

export function toTransactionPatch(
  values: TransactionFormValues,
): Omit<UpdateTransactionInput, 'id'> {
  return {
    ...values,
    category_id: values.category_id || null,
    transfer_to_account_id: values.transfer_to_account_id || null,
  };
}

interface FormMessages {
  destinationRequired: string;
  destinationDistinct: string;
  destinationUnexpected: string;
  categoryTypeMismatch: string;
}

const defaultMessages: FormMessages = {
  destinationRequired: 'Select a destination account',
  destinationDistinct: 'Choose a different destination account',
  destinationUnexpected: 'Only transfers can have a destination account',
  categoryTypeMismatch: 'Choose a category matching the transaction type',
};

export function createTransactionFormSchema(
  categories?: Pick<Category, 'id' | 'type'>[],
  messages: FormMessages = defaultMessages,
): z.ZodType<TransactionFormValues, TransactionFormValues> {
  return baseSchema.superRefine((draft, context) => {
    const destination = draft.transfer_to_account_id || undefined;
    if (draft.type === 'transfer') {
      if (!destination) {
        context.addIssue({
          code: 'custom',
          path: ['transfer_to_account_id'],
          message: messages.destinationRequired,
        });
      } else if (destination === draft.account_id) {
        context.addIssue({
          code: 'custom',
          path: ['transfer_to_account_id'],
          message: messages.destinationDistinct,
        });
      }
    } else if (destination) {
      context.addIssue({
        code: 'custom',
        path: ['transfer_to_account_id'],
        message: messages.destinationUnexpected,
      });
    }

    if (
      draft.category_id &&
      categories &&
      !categories.some(
        (category) => category.id === draft.category_id && category.type === draft.type,
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['category_id'],
        message: messages.categoryTypeMismatch,
      });
    }
  });
}

export function fieldsAfterTypeChange(
  current: Pick<TransactionFormValues, 'type' | 'category_id' | 'transfer_to_account_id'>,
  type: TransactionType,
): Pick<TransactionFormValues, 'type' | 'category_id' | 'transfer_to_account_id'> {
  if (type === current.type) {
    return {
      type,
      category_id: current.category_id,
      transfer_to_account_id: current.transfer_to_account_id,
    };
  }
  return { type, category_id: undefined, transfer_to_account_id: undefined };
}
