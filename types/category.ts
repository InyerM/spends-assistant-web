export type CategoryType = 'expense' | 'income' | 'transfer';

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
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  id: string;
}
