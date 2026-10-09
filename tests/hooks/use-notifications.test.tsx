import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useMarkNotificationsRead,
  useNotifications,
} from '@/lib/api/queries/notifications.queries';
const owner = vi.hoisted(() => ({ id: 'owner-a' as string | undefined }));
vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ supabaseUser: owner.id ? { id: owner.id } : null }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  owner.id = 'owner-a';
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}
describe('owner notification hooks', () => {
  it('does not fetch before authentication', () => {
    owner.id = undefined;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { client, wrapper } = setup();
    const hook = renderHook(() => useNotifications(), { wrapper });
    expect(fetcher).not.toHaveBeenCalled();
    hook.unmount();
    client.clear();
  });
  it('invalidates only the current owner after marking read', async () => {
    const { client, wrapper } = setup();
    const own = ['notifications', 'owner-a'];
    const other = ['notifications', 'owner-b'];
    client.setQueryData(own, {});
    client.setQueryData(other, {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ updated: 1 })));
    const hook = renderHook(() => useMarkNotificationsRead(), { wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync('notice');
    });
    expect(client.getQueryState(own)?.isInvalidated).toBe(true);
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    hook.unmount();
    client.clear();
  });
});
