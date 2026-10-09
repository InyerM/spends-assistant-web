import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useShortcutInbox } from '@/lib/api/queries/shortcut-inbox.queries';

let owner = 'owner-a';
vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: { supabaseUser: { id: string } }) => unknown) =>
    selector({ supabaseUser: { id: owner } }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('retains results while filtering but never carries a previous owner into the next session', async () => {
  const first = { data: [{ id: 'private-owner-a' }], count: 1 };
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(first))
      .mockImplementation(() => new Promise<Response>(() => {})),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }): React.ReactElement => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    ({ search }) => useShortcutInbox({ page: 1, status: 'pending', search }),
    {
      initialProps: { search: '' },
      wrapper,
    },
  );
  await waitFor(() => expect(view.result.current.data).toEqual(first));
  act(() => view.rerender({ search: 'purchase' }));
  expect(view.result.current.data).toEqual(first);
  expect(view.result.current.isPlaceholderData).toBe(true);
  owner = 'owner-b';
  act(() => view.rerender({ search: 'purchase' }));
  expect(view.result.current.data).toBeUndefined();
  expect(view.result.current.isPlaceholderData).toBe(false);
  view.unmount();
  client.clear();
});
