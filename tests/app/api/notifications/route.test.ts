import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/notifications/route';
import { AuthError, getUserClient } from '@/lib/api/server';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));
const rpc = vi.fn();
const request = (body: unknown) =>
  new NextRequest('http://localhost/api/notifications', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
describe('owner notifications API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rpc.mockResolvedValue({ data: [], error: null });
    vi.mocked(getUserClient).mockResolvedValue({ userId: 'owner', supabase: { rpc } as never });
  });
  it('requires authentication for reads and writes', async () => {
    vi.mocked(getUserClient).mockRejectedValue(new AuthError());
    expect((await GET()).status).toBe(401);
    expect((await PATCH(request({}))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('refreshes private owner notices', async () => {
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(rpc).toHaveBeenCalledWith('refresh_owner_notifications', {
      p_limit: 100,
      p_offset: 0,
      p_unread: false,
    });
  });
  it('rejects invalid ids and caller-supplied owners', async () => {
    expect((await PATCH(request({ id: 'bad' }))).status).toBe(400);
    expect((await PATCH(request({ user_id: 'another' }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('marks individually or all using only the notification read RPC', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    await PATCH(request({ id }));
    await PATCH(request({}));
    expect(rpc.mock.calls).toEqual([
      ['mark_owner_notifications_read', { p_id: id }],
      ['mark_owner_notifications_read', { p_id: null }],
    ]);
  });
  it('does not hide RPC failures', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    expect((await GET()).status).toBe(500);
    expect((await PATCH(request({}))).status).toBe(500);
  });
  it('validates owner pagination and unread filters', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/notifications?page=6&limit=20&unread=true'),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('refresh_owner_notifications', {
      p_limit: 20,
      p_offset: 100,
      p_unread: true,
    });
    expect((await GET(new NextRequest('http://localhost/api/notifications?page=0'))).status).toBe(
      400,
    );
    expect(
      (await GET(new NextRequest('http://localhost/api/notifications?unread=yes'))).status,
    ).toBe(400);
  });
});
