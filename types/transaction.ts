export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
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
  transfer_to_account_id?: string;
}

export interface UpdateTransactionInput extends Partial<CreateTransactionInput> {
  id: string;
}

export interface TransactionFilters {
  type?: TransactionType;
  account_id?: string;
  account_ids?: string[];
  category_id?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}
