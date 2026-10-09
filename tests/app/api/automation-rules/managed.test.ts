import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/automation-rules/generate-account-rules/route';
import { PATCH, DELETE } from '@/app/api/automation-rules/[id]/route';
const { getUserClient, rpc, from, single, query } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  single: vi.fn(),
  query: {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    is: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
  jsonResponse: (body: unknown, status = 200) => Response.json(body, { status }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ ...query, single });
  query.select.mockReturnValue({ ...query, single });
  query.eq.mockReturnValue({ ...query, single });
  query.not.mockReturnValue({ ...query, single });
  query.is.mockResolvedValue({ data: [{ id: 'managed' }], error: null });
  single.mockResolvedValue({ data: { managed_account_id: 'account' }, error: null });
  rpc.mockResolvedValue({ data: 1, error: null });
  getUserClient.mockResolvedValue({ supabase: { from, rpc }, userId: 'owner' });
});
describe('managed account rule routes', () => {
  it('synchronizes managed rules through an owned RPC without deleting custom rules', async () => {
    expect((await POST()).status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('sync_owned_account_detection_rules');
    expect(query.delete).not.toHaveBeenCalled();
  });
  it('stops mutation when owned synchronization fails', async () => {
    rpc.mockResolvedValue({ error: { message: 'Unavailable' } });
    expect((await POST()).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects edit and deletion of a managed rule before attempting a write', async () => {
    const context = { params: Promise.resolve({ id: 'managed' }) };
    expect(
      (
        await PATCH(
          new Request('https://example.test', { method: 'PATCH', body: '{}' }) as never,
          context,
        )
      ).status,
    ).toBe(409);
    expect((await DELETE(new Request('https://example.test') as never, context)).status).toBe(409);
    expect(query.update).not.toHaveBeenCalled();
    expect(query.delete).not.toHaveBeenCalled();
  });
});
