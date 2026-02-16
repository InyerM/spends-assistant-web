import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
}

interface UiActions {
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: false,

      setSidebarOpen: (open): void => {
        set({ sidebarOpen: open });
      },
      toggleSidebarCollapsed: (): void => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },
    }),
    {
      name: 'spends-ui-store',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
