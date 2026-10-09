import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, DELETE } from '@/app/api/financial-chat/history/route';
const mocks = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  AuthError: class AuthError extends Error {},
  getUserClient: mocks.getUserClient,
  errorResponse: (error: string, status: number) => Response.json({ error }, { status }),
}));
describe('owner chat history API', () => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), delete: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of ['select', 'eq', 'order', 'delete'] as const)
      query[method].mockReturnValue(query);
    query.range.mockResolvedValue({ data: [], error: null });
    mocks.getUserClient.mockResolvedValue({
      userId: 'owner',
      accessToken: 'jwt',
      supabase: { from: () => query },
    });
  });
  it('scopes paginated reads and never returns owner IDs or source snapshots', async () => {
    const response = await GET(
      new Request('https://my.anotto.app/api/financial-chat/history?page=2'),
    );
    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(query.range).toHaveBeenCalledWith(50, 75);
    expect(query.select.mock.calls[0][0]).not.toContain('user_id');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('rejects invalid pages before database access', async () => {
    expect(
      (await GET(new Request('https://my.anotto.app/api/financial-chat/history?page=-1'))).status,
    ).toBe(400);
    expect(query.select).not.toHaveBeenCalled();
  });
  it('rejects cross-origin cookie deletion', async () => {
    mocks.getUserClient.mockResolvedValue({ userId: 'owner', supabase: { from: () => query } });
    const response = await DELETE(
      new Request('https://my.anotto.app/api/financial-chat/history', {
        method: 'DELETE',
        body: '{}',
      }),
    );
    expect(response.status).toBe(403);
    expect(query.delete).not.toHaveBeenCalled();
  });
  it('permanently deletes only the authenticated owner entry', async () => {
    query.select.mockResolvedValue({
      data: [{ id: '11111111-1111-4111-8111-111111111111' }],
      error: null,
    });
    const response = await DELETE(
      new Request('https://my.anotto.app/api/financial-chat/history', {
        method: 'DELETE',
        body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', user_id: 'attacker' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(query.eq).toHaveBeenCalledWith('id', '11111111-1111-4111-8111-111111111111');
  });
});
