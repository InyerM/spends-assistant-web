import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from '@/app/api/shortcut-inbox/[id]/route';
import { AuthError } from '@/lib/api/server';

const { getUserClient, update, eq, maybeSingle } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const id = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id }) };
const request = (status: string): Request =>
  new Request(`https://example.test/api/shortcut-inbox/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    headers: { 'content-type': 'application/json' },
  });

describe('Shortcut inbox review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = { eq, select: () => ({ maybeSingle }) };
    eq.mockReturnValue(query);
    update.mockReturnValue(query);
    getUserClient.mockResolvedValue({ userId: 'owner-a', supabase: { from: () => ({ update }) } });
    maybeSingle.mockResolvedValue({ data: { id, status: 'non_transaction' }, error: null });
  });

  it('updates only the authenticated owner row', async () => {
    const response = await PATCH(request('non_transaction') as never, context);
    expect(response.status).toBe(200);
    expect(eq).toHaveBeenCalledWith('id', id);
    expect(eq).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(update).toHaveBeenCalledWith({ status: 'non_transaction' });
  });

  it('does not reveal another user row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await PATCH(request('dismissed') as never, context);
    expect(response.status).toBe(404);
  });

  it('rejects a financial confirmation status', async () => {
    const response = await PATCH(request('confirmed') as never, context);
    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('reports immutable matched review state as a conflict', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: '23514' } });
    const response = await PATCH(request('dismissed') as never, context);
    expect(response.status).toBe(409);
  });

  it('rejects review without a browser session', async () => {
    getUserClient.mockRejectedValue(new AuthError());
    const response = await PATCH(request('dismissed') as never, context);
    expect(response.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});
