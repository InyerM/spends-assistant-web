import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { getUserClient } from '@/lib/api/server';
import { POST } from '@/app/api/accounts/[id]/currencies/route';
const rpc = vi.fn(),
  id = '10000000-0000-4000-8000-000000000001',
  context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'token',
    supabase: { rpc } as never,
  });
  rpc.mockResolvedValue({ data: { id, currency: 'USD' }, error: null });
});
it('enables a currency through the owner authority and rejects unsupported payloads', async () => {
  const request = (body: unknown) =>
    new Request('https://my.anotto.app/api/accounts/' + id + '/currencies', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  expect((await POST(request({ currency: 'USD' }), context)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('enable_account_currency', { p_account: id, p_currency: 'USD' });
  expect((await POST(request({ currency: 'EUR' }), context)).status).toBe(400);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('rejects cross-origin cookie writes', async () => {
  vi.mocked(getUserClient).mockResolvedValue({ userId: 'owner', supabase: { rpc } as never });
  expect(
    (
      await POST(
        new Request('https://my.anotto.app/api/accounts/' + id + '/currencies', {
          method: 'POST',
          headers: { Origin: 'https://elsewhere.test' },
          body: JSON.stringify({ currency: 'USD' }),
        }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
