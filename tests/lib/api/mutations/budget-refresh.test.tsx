import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useCreateTransaction } from '@/lib/api/mutations/transaction.mutations';
import { budgetKeys } from '@/lib/api/queries/budget.queries';
import { createMockTransaction } from '@/tests/__test-helpers__/factories';

describe('budget cache after a transaction changes', () => {
  it('invalidates the monthly budget total after a successful transaction create', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = budgetKeys.month('2026-10-01');
    client.setQueryData(key, [{ spent_cop: '100.00' }]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(createMockTransaction())),
    );
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useCreateTransaction(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        date: '2026-10-08',
        time: '12:00',
        amount: 50,
        description: 'Lunch',
        account_id: 'account-1',
        type: 'expense',
        source: 'manual',
      });
    });

    await waitFor(() => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    vi.unstubAllGlobals();
    client.clear();
  });
});
