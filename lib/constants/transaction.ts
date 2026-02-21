import type { TransactionType } from '@/types';

export const TRANSACTION_TYPES: { value: TransactionType; labelKey: string }[] = [
  { value: 'expense', labelKey: 'expense' },
  { value: 'income', labelKey: 'income' },
  { value: 'transfer', labelKey: 'transfer' },
];

export const SORT_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'date-desc', labelKey: 'newestFirst' },
  { value: 'date-asc', labelKey: 'oldestFirst' },
  { value: 'amount-desc', labelKey: 'highestAmount' },
  { value: 'amount-asc', labelKey: 'lowestAmount' },
];
