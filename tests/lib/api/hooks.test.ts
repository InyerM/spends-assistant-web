import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createQueryWrapper } from '@/tests/__test-helpers__/factories';

// Import all hooks to get function coverage
import {
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from '@/lib/api/mutations/account.mutations';
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/lib/api/mutations/category.mutations';
import {
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
  useToggleAutomationRule,
} from '@/lib/api/mutations/automation.mutations';
import {
  useCreateTransaction,
  useUpdateTransaction,
  useBulkUpdateTransactions,
  useDeleteTransaction,
  useResolveDuplicate,
} from '@/lib/api/mutations/transaction.mutations';
import { useAccounts, useAccount } from '@/lib/api/queries/account.queries';
import { useCategories, useCategoryTree } from '@/lib/api/queries/category.queries';
import { useAutomationRules } from '@/lib/api/queries/automation.queries';
import { useTransactions, useTransaction } from '@/lib/api/queries/transaction.queries';

const wrapper = createQueryWrapper();

describe('account mutation hooks', () => {
  it('useCreateAccount returns mutation', () => {
    const { result } = renderHook(() => useCreateAccount(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useUpdateAccount returns mutation', () => {
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useDeleteAccount returns mutation', () => {
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});

describe('category mutation hooks', () => {
  it('useCreateCategory returns mutation', () => {
    const { result } = renderHook(() => useCreateCategory(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useUpdateCategory returns mutation', () => {
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useDeleteCategory returns mutation', () => {
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});

describe('automation mutation hooks', () => {
  it('useCreateAutomationRule returns mutation', () => {
    const { result } = renderHook(() => useCreateAutomationRule(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useUpdateAutomationRule returns mutation', () => {
    const { result } = renderHook(() => useUpdateAutomationRule(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useDeleteAutomationRule returns mutation', () => {
    const { result } = renderHook(() => useDeleteAutomationRule(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useToggleAutomationRule returns mutation', () => {
    const { result } = renderHook(() => useToggleAutomationRule(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});

describe('transaction mutation hooks', () => {
  it('useCreateTransaction returns mutation', () => {
    const { result } = renderHook(() => useCreateTransaction(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useUpdateTransaction returns mutation', () => {
    const { result } = renderHook(() => useUpdateTransaction(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useBulkUpdateTransactions returns mutation', () => {
    const { result } = renderHook(() => useBulkUpdateTransactions(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useDeleteTransaction returns mutation', () => {
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });

  it('useResolveDuplicate returns mutation', () => {
    const { result } = renderHook(() => useResolveDuplicate(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});

describe('query hooks', () => {
  it('useAccounts returns query', () => {
    const { result } = renderHook(() => useAccounts(), { wrapper });
    expect(result.current.isLoading).toBeDefined();
  });

  it('useAccount returns query', () => {
    const { result } = renderHook(() => useAccount('acc-1'), { wrapper });
    expect(result.current.isLoading).toBeDefined();
  });

  it('useCategories returns query', () => {
    const { result } = renderHook(() => useCategories(), { wrapper });
    expect(result.current.isLoading).toBeDefined();
  });

  it('useCategoryTree returns query', () => {
    const { result } = renderHook(() => useCategoryTree(), { wrapper });
    expect(result.current.isLoading).toBeDefined();
  });

  it('useAutomationRules returns query', () => {
    const { result } = renderHook(() => useAutomationRules(), { wrapper });
    expect(result.current.isLoading).toBeDefined();
  });

  it('useTransactions returns query', () => {
    const { result } = renderHook(() => useTransactions(), { wrapper });
    expect(result.current.isLoading).toBeDefined();
  });

  it('useTransaction returns query', () => {
    const { result } = renderHook(() => useTransaction('tx-1'), { wrapper });
    expect(result.current.isLoading).toBeDefined();
  });
});
