export type CategoryType = 'expense' | 'income' | 'transfer';

export type SpendingNature = 'none' | 'want' | 'need' | 'must';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  type: CategoryType;
  parent_id: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  is_default?: boolean;
  spending_nature?: SpendingNature;
  translations?: Record<string, string>;
  created_at: string;
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  type: CategoryType;
  parent_id?: string;
  icon?: string;
  color?: string;
  spending_nature?: SpendingNature;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  id: string;
}
