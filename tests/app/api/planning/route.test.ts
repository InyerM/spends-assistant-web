import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { getUserClient, AuthError } from '@/lib/api/server';
import { POST } from '@/app/api/planning/route';
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'test',
    supabase: { rpc } as never,
  });
});
it('preserves the idempotency key, rejects malformed inputs and enforces terms errors', async () => {
  const request_id = crypto.randomUUID(),
    payload = { action: 'preferences', preferences: { dashboard_widgets: ['goals'] } };
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
  const request = (body: string) =>
    new Request('https://my.anotto.app/api/planning', { method: 'POST', body });
  expect((await POST(request(JSON.stringify({ request_id, payload })))).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('apply_planning_command', {
    p_request_id: request_id,
    p_payload: payload,
  });
  expect((await POST(request('{'))).status).toBe(400);
  expect((await POST(request('x'.repeat(8193)))).status).toBe(413);
  rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
  expect((await POST(request(JSON.stringify({ request_id, payload })))).status).toBe(403);
  vi.mocked(getUserClient).mockRejectedValue(new AuthError('missing'));
  expect((await POST(request('{}'))).status).toBe(401);
});
