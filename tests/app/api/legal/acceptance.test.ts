import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/legal/acceptance/route';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }),
}));
const request = (body: unknown, origin = 'https://my.anotto.app') =>
  new Request('https://my.anotto.app/api/legal/acceptance', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
});
it('requires an explicit current version and rejects cross-origin submissions', async () => {
  expect((await POST(request({ accepted: false, version: '2026-10-08' }))).status).toBe(400);
  expect((await POST(request({ accepted: true, version: 'old' }))).status).toBe(400);
  expect(
    (await POST(request({ accepted: true, version: '2026-10-08' }, 'https://evil.example'))).status,
  ).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('persists only for the authenticated owner and keeps responses private', async () => {
  const response = await POST(
    request({ accepted: true, version: '2026-10-08', user_id: 'another-user' }),
  );
  expect(response.status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith('accept_current_terms', { p_version: '2026-10-08' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
});
it('cannot persist without authentication or mask a storage failure', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request({ accepted: true, version: '2026-10-08' }))).status).toBe(401);
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  mocks.rpc.mockResolvedValue({ error: { message: 'private SQL error' } });
  expect((await POST(request({ accepted: true, version: '2026-10-08' }))).status).toBe(503);
});
