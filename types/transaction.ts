export type TransactionType = 'expense' | 'income' | 'transfer';

export interface AppliedRule {
  rule_id: string;
  rule_name: string;
  actions: Record<string, unknown>;
}

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  time: string;
  amount: number;
  description: string;
  notes: string | null;
  category_id: string | null;
  account_id: string;
  type: TransactionType;
  payment_method: string | null;
  source: string;
  confidence: number | null;
  transfer_to_account_id: string | null;
  transfer_id: string | null;
  is_reconciled: boolean;
  reconciled_at: string | null;
  reconciliation_id: string | null;
  raw_text: string | null;
  parsed_data: Record<string, unknown> | null;
  applied_rules: AppliedRule[] | null;
  duplicate_status: 'pending_review' | 'confirmed' | null;
  duplicate_of: string | null;
  import_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionInput {
  date: string;
  time: string;
  amount: number;
  description: string;
  notes?: string;
  category_id?: string;
  account_id: string;
  type: TransactionType;
  payment_method?: string;
  source: string;
  confidence?: number;
  transfer_to_account_id?: string;
  transfer_id?: string;
  raw_text?: string;
  parsed_data?: Record<string, unknown>;
  applied_rules?: AppliedRule[];
  duplicate_status?: 'pending_review' | 'confirmed' | null;
  duplicate_of?: string;
}

export interface UpdateTransactionInput extends Partial<CreateTransactionInput> {
  id: string;
}

export interface BulkUpdateTransactionInput {
  ids: string[];
  updates: {
    type?: TransactionType;
    category_id?: string | null;
    account_id?: string;
  };
}

export interface TransactionFilters {
  type?: TransactionType;
  types?: TransactionType[];
  account_id?: string;
  account_ids?: string[];
  category_id?: string;
  category_ids?: string[];
  source?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'date' | 'amount';
  sort_order?: 'asc' | 'desc';
  duplicate_status?: 'pending_review';
  import_id?: string;
}
