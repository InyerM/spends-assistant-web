import { createElement, type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ owner: undefined as string | undefined }));
vi.mock('@/store/auth-store', () => ({ useAuthStore: () => state.owner }));
import { useStatementProofs } from '@/lib/api/queries/statement.queries';
afterEach(() => {
  vi.unstubAllGlobals();
  state.owner = undefined;
});
it('does not fetch before authentication and isolates the statement evidence cache when owners change', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetch = vi.fn(async () =>
    Response.json({ data: [{ transaction_id: state.owner, valid: true }] }),
  );
  vi.stubGlobal('fetch', fetch);
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);
  const { result, rerender } = renderHook(() => useStatementProofs(['tx']), { wrapper });
  expect(fetch).not.toHaveBeenCalled();
  act(() => {
    state.owner = 'first';
    rerender();
  });
  await waitFor(() => expect(result.current.data?.[0].transaction_id).toBe('first'));
  act(() => {
    state.owner = 'second';
    rerender();
  });
  expect(result.current.data).toBeUndefined();
  await waitFor(() => expect(result.current.data?.[0].transaction_id).toBe('second'));
  expect(fetch).toHaveBeenCalledTimes(2);
  client.clear();
});
