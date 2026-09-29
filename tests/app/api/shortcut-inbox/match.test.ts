import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shortcut-inbox/[id]/match/route';
import { AuthError } from '@/lib/api/server';

const { getUserClient, rpc } = vi.hoisted(() => ({ getUserClient: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const inboxId = '11111111-1111-4111-8111-111111111111';
const transactionId = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id: inboxId }) };
const request = (body: unknown): Request =>
  new Request(`https://example.test/api/shortcut-inbox/${inboxId}/match`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Shortcut existing-transaction match acknowledgement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({ userId: 'owner-a', supabase: { rpc } });
    rpc.mockResolvedValue({ data: '33333333-3333-4333-8333-333333333333', error: null });
  });

  it('calls only the owner-scoped database decision RPC after explicit selection', async () => {
    const response = await POST(request({ transaction_id: transactionId }) as never, context);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('acknowledge_shortcut_match', {
      p_inbox_item_id: inboxId,
      p_transaction_id: transactionId,
    });
    expect(await response.json()).toEqual({ decision_id: '33333333-3333-4333-8333-333333333333' });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects missing auth and malformed IDs without calling the RPC', async () => {
    expect((await POST(request({ transaction_id: 'bad' }) as never, context)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    getUserClient.mockRejectedValue(new AuthError());
    expect((await POST(request({ transaction_id: transactionId }) as never, context)).status).toBe(
      401,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not reveal a cross-owner or deleted transaction', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } });
    const response = await POST(request({ transaction_id: transactionId }) as never, context);
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain(transactionId);
  });

  it('reports a competing or nonpending decision as conflict', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505' } });
    expect((await POST(request({ transaction_id: transactionId }) as never, context)).status).toBe(
      409,
    );
    rpc.mockResolvedValue({ data: null, error: { code: '23514' } });
    expect((await POST(request({ transaction_id: transactionId }) as never, context)).status).toBe(
      409,
    );
  });

  it('rejects an unstructured payload and a forged user field', async () => {
    expect((await POST(request([]) as never, context)).status).toBe(400);
    expect(
      (await POST(request({ transaction_id: transactionId, user_id: 'other' }) as never, context))
        .status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
