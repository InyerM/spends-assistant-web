import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/relief-funds/route';
import { getUserClient } from '@/lib/api/server';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const requestId = '22222222-2222-4222-8222-222222222222';
const event = {
  action: 'create_fund',
  title: 'August 2026 relief',
  purpose: 'Emergency supply purchases',
  currency: 'COP',
};
const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('http://localhost/api/relief-funds', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

describe('/api/relief-funds', () => {
  const rpc = vi.fn();
  const order = vi.fn();
  const eq = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    order.mockResolvedValue({ data: [], error: null });
    eq.mockReturnValue({ order });
    vi.mocked(getUserClient).mockResolvedValue({
      userId: 'owner-1',
      supabase: { rpc, from: vi.fn(() => ({ select: () => ({ eq }) })) } as never,
    });
  });

  it('lists only the authenticated owner funds', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(eq).toHaveBeenCalledWith('user_id', 'owner-1');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('requires review before persisting', async () => {
    const response = await post({ request_id: requestId, reviewed: false, event });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends a reviewed event to the idempotent RPC', async () => {
    rpc.mockResolvedValue({ data: { fund_id: 'new', replayed: false }, error: null });
    const response = await post({ request_id: requestId, reviewed: true, event });
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('confirm_relief_fund_event', {
      p_request_id: requestId,
      p_reviewed: true,
      p_event: event,
    });
  });
});
