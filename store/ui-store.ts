import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
}

interface UiActions {
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,

  setSidebarOpen: (open): void => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: (): void =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
