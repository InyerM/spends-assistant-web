import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/settings/account/delete/route';

const mocks = vi.hoisted(() => ({ getUserClient: vi.fn(), getAdminClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  ...mocks,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const owner = '11111111-1111-4111-8111-111111111111';

function request(confirmation: string, authorization = 'Bearer synthetic-token'): Request {
  return new Request('https://anotto.app/api/settings/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authorization },
    body: JSON.stringify({ confirmation }),
  });
}

describe('POST /api/settings/account/delete', () => {
  const remove = vi.fn();
  const list = vi.fn();
  const deleteUser = vi.fn();
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserClient.mockResolvedValue({
      userId: owner,
      accessToken: 'synthetic-token',
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: owner, email: 'owner@example.com' } },
            error: null,
          }),
        },
      },
    });
    list.mockResolvedValue({ data: [], error: null });
    remove.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    mocks.getAdminClient.mockReturnValue({
      rpc,
      storage: { from: vi.fn(() => ({ list, remove })) },
      auth: { admin: { deleteUser } },
    });
  });

  it('requires the signed-in owner to type their email', async () => {
    const response = await POST(request('DELETE'));
    expect(response.status).toBe(400);
    expect(mocks.getUserClient).toHaveBeenCalledWith(expect.any(Request));
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('removes both storage buckets before deleting the auth user', async () => {
    list.mockResolvedValueOnce({ data: [{ name: 'receipt.jpg' }], error: null });
    const response = await POST(request('owner@example.com'));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('account_deletion_ready');
    expect(remove).toHaveBeenCalledWith([`${owner}/receipt.jpg`]);
    expect(deleteUser).toHaveBeenCalledWith(owner, false);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0]);
  });

  it('keeps auth intact if a storage deletion fails', async () => {
    list.mockResolvedValueOnce({ data: [{ name: 'receipt.jpg' }], error: null });
    remove.mockResolvedValueOnce({ error: new Error('storage unavailable') });
    const response = await POST(request('owner@example.com'));
    expect(response.status).toBe(503);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('does not delete when the cascade migration is unavailable', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('missing function') });
    const response = await POST(request('owner@example.com'));
    expect(response.status).toBe(503);
    expect(list).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('does not trust mismatched auth identities', async () => {
    mocks.getUserClient.mockResolvedValueOnce({
      userId: owner,
      accessToken: 'synthetic-token',
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'other', email: 'owner@example.com' } },
            error: null,
          }),
        },
      },
    });
    const response = await POST(request('owner@example.com'));
    expect(response.status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
