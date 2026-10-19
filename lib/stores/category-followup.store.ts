import { create } from 'zustand';
export const useCategoryFollowupStore = create<{
  transactionId: string | null;
  revision: number;
  direct: boolean;
  offer: (id: string, direct?: boolean) => void;
  clear: () => void;
}>((set) => ({
  transactionId: null,
  revision: 0,
  direct: false,
  offer: (transactionId, direct = false): void =>
    set((state) => ({ transactionId, direct, revision: state.revision + 1 })),
  clear: (): void => set({ transactionId: null }),
}));
