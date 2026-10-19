import { create } from 'zustand';
export const useCategoryFollowupStore = create<{
  transactionId: string | null;
  offer: (id: string) => void;
  clear: () => void;
}>((set) => ({
  transactionId: null,
  offer: (transactionId): void => set({ transactionId }),
  clear: (): void => set({ transactionId: null }),
}));
