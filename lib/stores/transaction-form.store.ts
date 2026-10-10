import { create } from 'zustand';
import type { Transaction } from '@/types';

export interface TransactionDraft {
  amount?: number;
  description?: string;
  notes?: string;
  type?: 'expense' | 'income' | 'transfer';
  account_id?: string;
  category_id?: string;
  transfer_to_account_id?: string;
}

interface TransactionFormStore {
  draft: TransactionDraft | null;
  openDraft: (draft: TransactionDraft) => void;
  open: boolean;
  transaction: Transaction | null;
  setOpen: (open: boolean) => void;
  openNew: () => void;
  openWith: (transaction: Transaction) => void;
  close: () => void;
}

export const useTransactionFormStore = create<TransactionFormStore>((set) => ({
  draft: null,
  openDraft: (draft): void => set({ open: true, transaction: null, draft }),
  open: false,
  transaction: null,
  setOpen: (open): void => {
    if (!open) set({ open: false, transaction: null, draft: null });
    else set({ open: true });
  },
  openNew: (): void => set({ open: true, transaction: null, draft: null }),
  openWith: (transaction): void => set({ open: true, transaction, draft: null }),
  close: (): void => set({ open: false, transaction: null, draft: null }),
}));
