import type { CategoryType, SpendingNature } from '@/types';

export const TYPE_BADGE_VARIANT: Record<CategoryType, 'destructive' | 'default' | 'secondary'> = {
  expense: 'destructive',
  income: 'default',
  transfer: 'secondary',
};

export const SPENDING_NATURE_BADGE_VARIANT: Record<
  SpendingNature,
  'outline' | 'default' | 'secondary' | 'destructive'
> = {
  none: 'outline',
  want: 'secondary',
  need: 'default',
  must: 'destructive',
};

export const STATUS_BADGE_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  completed: 'default',
  pending: 'secondary',
  failed: 'destructive',
};
