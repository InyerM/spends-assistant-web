import { describe, it, expect, beforeEach } from 'vitest';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { createMockTransaction } from '@/tests/__test-helpers__/factories';

describe('useTransactionFormStore', () => {
  beforeEach(() => {
    useTransactionFormStore.setState({
      open: false,
      transaction: null,
    });
  });

  it('has correct initial state', () => {
    const state = useTransactionFormStore.getState();
    expect(state.open).toBe(false);
    expect(state.transaction).toBeNull();
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

  it('setOpen(false) clears transaction', () => {
    const tx = createMockTransaction();
    useTransactionFormStore.getState().openWith(tx);
    useTransactionFormStore.getState().setOpen(false);
    const state = useTransactionFormStore.getState();
    expect(state.open).toBe(false);
    expect(state.transaction).toBeNull();
  });
});
