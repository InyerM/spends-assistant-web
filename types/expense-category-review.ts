import type { CategoryReview } from '@/lib/category-review';
export interface ExpenseReviewRow {
  id: string;
  description: string;
  notes: string | null;
  category_id: string | null;
  account_id: string;
  type: 'expense';
  date: string;
  amount: number;
  currency: string | null;
}
export interface ExpenseReviewPage {
  data: ExpenseReviewRow[];
  count: number;
  page: number;
}
export interface ExpenseReviewResult {
  id: string;
  proposal?: CategoryReview;
  baseline?: Readonly<ExpenseReviewRow>;
  stale?: boolean;
  error?: Error;
}

export interface ExpenseReviewChanges {
  category_id?: string;
  description?: string;
  notes?: string | null;
}
