import { create } from 'zustand';
import type { Transaction } from '@/types';

interface TransactionFormStore {
  open: boolean;
  transaction: Transaction | null;
  setOpen: (open: boolean) => void;
  openNew: () => void;
  openWith: (transaction: Transaction) => void;
  close: () => void;
}

export const useTransactionFormStore = create<TransactionFormStore>((set) => ({
  open: false,
  transaction: null,
  setOpen: (open): void => {
    if (!open) set({ open: false, transaction: null });
    else set({ open: true });
  },
  openNew: (): void => set({ open: true, transaction: null }),
  openWith: (transaction): void => set({ open: true, transaction }),
  close: (): void => set({ open: false, transaction: null }),
}));
