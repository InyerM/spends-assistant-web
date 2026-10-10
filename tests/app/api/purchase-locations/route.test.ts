import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { getUserClient, AuthError } from '@/lib/api/server';
import { GET } from '@/app/api/purchase-locations/route';
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'test',
    supabase: { rpc } as never,
  });
});
it('uses the owner RPC, bounds pagination and requires authentication', async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  const response = await GET(
    new Request('https://my.anotto.app/api/purchase-locations?offset=100'),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(rpc).toHaveBeenCalledWith('get_purchase_locations', { p_limit: 100, p_offset: 100 });
  rpc.mockClear();
  expect(
    (await GET(new Request('https://my.anotto.app/api/purchase-locations?offset=-1'))).status,
  ).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
  vi.mocked(getUserClient).mockRejectedValue(new AuthError('missing'));
  expect((await GET(new Request('https://my.anotto.app/api/purchase-locations'))).status).toBe(401);
});
