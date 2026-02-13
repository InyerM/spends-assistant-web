import { describe, it, expect, beforeEach } from 'vitest';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { createMockTransaction } from '@/tests/__test-helpers__/factories';

describe('useTransactionFormStore', () => {
  beforeEach(() => {
    useTransactionFormStore.setState({
      open: false,
      transaction: null,
      aiOpen: false,
    });
  });

  it('has correct initial state', () => {
    const state = useTransactionFormStore.getState();
    expect(state.open).toBe(false);
    expect(state.transaction).toBeNull();
    expect(state.aiOpen).toBe(false);
  });

  it('openNew opens form with no transaction', () => {
    useTransactionFormStore.getState().openNew();
    const state = useTransactionFormStore.getState();
    expect(state.open).toBe(true);
    expect(state.transaction).toBeNull();
  });

  it('openWith opens form with specific transaction', () => {
    const tx = createMockTransaction();
    useTransactionFormStore.getState().openWith(tx);
    const state = useTransactionFormStore.getState();
    expect(state.open).toBe(true);
    expect(state.transaction).toEqual(tx);
  });

  it('close resets state', () => {
    useTransactionFormStore.getState().openNew();
    useTransactionFormStore.getState().close();
    const state = useTransactionFormStore.getState();
    expect(state.open).toBe(false);
    expect(state.transaction).toBeNull();
  });

  it('openAi opens AI dialog', () => {
    useTransactionFormStore.getState().openAi();
    const state = useTransactionFormStore.getState();
    expect(state.aiOpen).toBe(true);
    expect(state.open).toBe(false);
  });

  it('setOpen(false) clears transaction', () => {
    const tx = createMockTransaction();
    useTransactionFormStore.getState().openWith(tx);
    useTransactionFormStore.getState().setOpen(false);
    const state = useTransactionFormStore.getState();
    expect(state.open).toBe(false);
    expect(state.transaction).toBeNull();
  });

  it('setAiOpen(false) closes AI dialog', () => {
    useTransactionFormStore.getState().openAi();
    useTransactionFormStore.getState().setAiOpen(false);
    expect(useTransactionFormStore.getState().aiOpen).toBe(false);
  });
});
