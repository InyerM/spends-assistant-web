import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/shortcut-inbox/pending-count/route';
const { eq, select, from, getUserClient } = vi.hoisted(() => ({
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  getUserClient: vi.fn(),
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  eq.mockReturnValue({ eq });
  select.mockReturnValue({ eq });
  from.mockReturnValue({ select });
  getUserClient.mockResolvedValue({ userId: 'owner', supabase: { from } });
});
it('counts all pending sources for the authenticated owner without selecting messages', async () => {
  eq.mockReturnValueOnce({ eq }).mockResolvedValueOnce({ count: 7, error: null });
  const response = await GET(new Request('https://my.anotto.app/api/shortcut-inbox/pending-count'));
  expect(await response.json()).toEqual({ count: 7 });
  expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
  expect(eq).toHaveBeenNthCalledWith(1, 'user_id', 'owner');
  expect(eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('does not turn database failure into a zero badge', async () => {
  eq.mockReturnValueOnce({ eq }).mockResolvedValueOnce({
    error: { message: 'failure' },
    count: null,
  });
  expect(
    (await GET(new Request('https://my.anotto.app/api/shortcut-inbox/pending-count'))).status,
  ).toBe(500);
});
