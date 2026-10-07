export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'cash'
  | 'investment'
  | 'crypto'
  | 'credit';

export interface AccountIdentifier {
  kind: 'bank_account' | 'debit_card' | 'credit_card' | 'other';
  last_four: string;
  is_active: boolean;
  is_primary: boolean;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  last_four: string | null;
  bank_account_last_four?: string | null;
  identifiers?: AccountIdentifier[];
  currency: string;
  balance: number;
  is_active: boolean;
  is_default?: boolean;
  color: string | null;
  icon: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  institution?: string;
  last_four?: string | null;
  identifiers?: AccountIdentifier[];
  currency?: string;
  balance?: number;
  color?: string;
  icon?: string;
}

export interface UpdateAccountInput extends Omit<
  Partial<CreateAccountInput>,
  'balance' | 'currency'
> {
  id: string;
}
