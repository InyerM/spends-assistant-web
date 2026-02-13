import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/store/ui-store';

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarOpen: false, sidebarCollapsed: false });
  });

  it('has correct initial state', () => {
    const state = useUiStore.getState();
    expect(state.sidebarOpen).toBe(false);
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('setSidebarOpen updates state', () => {
    useUiStore.getState().setSidebarOpen(true);
    expect(useUiStore.getState().sidebarOpen).toBe(true);
  });

  it('toggleSidebarCollapsed toggles state', () => {
    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);

    useUiStore.getState().toggleSidebarCollapsed();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });
});
