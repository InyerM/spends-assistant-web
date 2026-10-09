import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from '@/lib/api/mutations/account.mutations';
import { automationKeys } from '@/lib/api/queries/automation.queries';
import type { CreateAccountInput } from '@/types';

afterEach(() => vi.unstubAllGlobals());
describe('account writes refresh automatic rules', () => {
  it('invalidates rule queries after create, update and archive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ id: 'account' })),
    );
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        create: useCreateAccount(),
        update: useUpdateAccount(),
        remove: useDeleteAccount(),
      }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );
    await act(async () => {
      await result.current.create.mutateAsync({
        name: 'Savings',
        type: 'savings',
      } as CreateAccountInput);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: automationKeys.all });
    invalidate.mockClear();
    await act(async () => {
      await result.current.update.mutateAsync({ id: 'account', name: 'Updated' });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: automationKeys.all });
    invalidate.mockClear();
    await act(async () => {
      await result.current.remove.mutateAsync('account');
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: automationKeys.all });
    client.clear();
  });
});
