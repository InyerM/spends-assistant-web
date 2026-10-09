import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/accounts/[id]/balance/route';
import { getUserClient } from '@/lib/api/server';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  jsonResponse: (data: unknown) => Response.json(data),
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
const rpc = vi.fn();
const accountId = '33333333-3333-4333-8333-333333333333';
const requestId = '77777777-7777-4777-8777-777777777777';
const request = (data: unknown) =>
  new NextRequest('http://localhost/api/accounts/' + accountId + '/balance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({ supabase: { rpc } as never, userId: 'owner' });
  rpc.mockResolvedValue({ data: { balance: 80 }, error: null });
});
it('sends the target to the authoritative owner RPC for either mode', async () => {
  for (const mode of ['manual', 'transaction']) {
    const response = await POST(request({ request_id: requestId, target: 80, mode }), {
      params: Promise.resolve({ id: accountId }),
    });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('adjust_account_balance', {
      p_request_id: requestId,
      p_account_id: accountId,
      p_target: 80,
      p_mode: mode,
      p_source: 'web',
    });
  }
});
it('rejects delta payloads and excessive precision before database writes', async () => {
  for (const data of [
    { request_id: requestId, amount: 80, mode: 'transaction' },
    { request_id: requestId, target: 0.001, mode: 'manual' },
  ]) {
    expect((await POST(request(data), { params: Promise.resolve({ id: accountId }) })).status).toBe(
      400,
    );
  }
  expect(rpc).not.toHaveBeenCalled();
});
it('returns owner lookup and quota failures', async () => {
  rpc.mockResolvedValue({ error: { code: 'P0002', message: 'Owned active account not found' } });
  expect(
    (
      await POST(request({ request_id: requestId, target: 80, mode: 'manual' }), {
        params: Promise.resolve({ id: accountId }),
      })
    ).status,
  ).toBe(404);
});
