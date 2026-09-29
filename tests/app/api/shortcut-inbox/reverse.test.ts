import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shortcut-inbox/[id]/reverse/route';
import { AuthError } from '@/lib/api/server';

const { getUserClient, rpc } = vi.hoisted(() => ({ getUserClient: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const inboxId = '11111111-1111-4111-8111-111111111111';
const decisionId = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id: inboxId }) };
const request = (body: unknown): Request =>
  new Request(`https://example.test/api/shortcut-inbox/${inboxId}/reverse`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Shortcut existing match reversal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({ userId: 'owner-a', supabase: { rpc } });
    rpc.mockResolvedValue({ data: '33333333-3333-4333-8333-333333333333', error: null });
  });

  it('calls the owner-scoped reversal RPC with the reviewed decision', async () => {
    const response = await POST(request({ decision_id: decisionId }) as never, context);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('reverse_shortcut_match', {
      p_inbox_item_id: inboxId,
      p_decision_id: decisionId,
    });
    expect(await response.json()).toEqual({ reversal_id: '33333333-3333-4333-8333-333333333333' });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects forged fields, invalid IDs, and missing auth before the RPC', async () => {
    expect((await POST(request({ decision_id: 'bad' }) as never, context)).status).toBe(400);
    expect(
      (await POST(request({ decision_id: decisionId, user_id: 'other' }) as never, context)).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    getUserClient.mockRejectedValue(new AuthError());
    expect((await POST(request({ decision_id: decisionId }) as never, context)).status).toBe(401);
  });

  it("does not disclose another owner's decision and maps a stale review to conflict", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } });
    expect((await POST(request({ decision_id: decisionId }) as never, context)).status).toBe(404);
    rpc.mockResolvedValue({ data: null, error: { code: '23514' } });
    expect((await POST(request({ decision_id: decisionId }) as never, context)).status).toBe(409);
  });
});
