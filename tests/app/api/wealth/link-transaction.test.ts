import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/wealth-links/route';

const { getUserClient, rpc } = vi.hoisted(() => ({ getUserClient: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

describe('reviewed wealth transaction links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({ supabase: { rpc } });
    rpc.mockResolvedValue({ data: { unchanged: false }, error: null });
  });

  it('requires explicit review and sends an owner-scoped RPC', async () => {
    const body = {
      kind: 'loan_event',
      event_id: '00000000-0000-4000-8000-000000000001',
      transaction_id: '00000000-0000-4000-8000-000000000002',
      reviewed: true,
    };
    const response = await POST(
      new Request('http://localhost/api/wealth-links', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('link_manual_wealth_event', {
      p_kind: body.kind,
      p_event_id: body.event_id,
      p_transaction_id: body.transaction_id,
      p_reviewed: true,
    });
    const rejected = await POST(
      new Request('http://localhost/api/wealth-links', {
        method: 'POST',
        body: JSON.stringify({ ...body, reviewed: false }),
      }),
    );
    expect(rejected.status).toBe(400);
  });
});
