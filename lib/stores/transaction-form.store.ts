import { create } from 'zustand';
import type { Transaction } from '@/types';

interface TransactionFormStore {
  open: boolean;
  transaction: Transaction | null;
  aiOpen: boolean;
  setOpen: (open: boolean) => void;
  openNew: () => void;
  openWith: (transaction: Transaction) => void;
  openAi: () => void;
  setAiOpen: (open: boolean) => void;
  close: () => void;
}

export const useTransactionFormStore = create<TransactionFormStore>((set) => ({
  open: false,
  transaction: null,
  aiOpen: false,
  setOpen: (open): void => {
    if (!open) set({ open: false, transaction: null });
    else set({ open: true });
  },
  openNew: (): void => set({ open: true, transaction: null }),
  openWith: (transaction): void => set({ open: true, transaction }),
  openAi: (): void => set({ aiOpen: true, open: false, transaction: null }),
  setAiOpen: (aiOpen): void => {
    if (!aiOpen) set({ aiOpen: false });
    else set({ aiOpen: true });
  },
  close: (): void => set({ open: false, transaction: null }),
}));
