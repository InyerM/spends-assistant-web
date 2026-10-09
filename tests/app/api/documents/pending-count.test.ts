import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/documents/pending-count/route';
const { rpc, getUserClient } = vi.hoisted(() => ({ rpc: vi.fn(), getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  getUserClient.mockResolvedValue({ supabase: { rpc } });
});
it('uses the owner-scoped pending count without exposing documents', async () => {
  rpc.mockResolvedValue({ data: 3, error: null });
  const request = new Request('https://my.anotto.app/api/documents/pending-count');
  const response = await GET(request);
  expect(await response.json()).toEqual({ count: 3 });
  expect(rpc).toHaveBeenCalledWith('pending_document_count');
  expect(getUserClient).toHaveBeenCalledWith(request);
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('does not report zero when the count fails', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'failure' } });
  expect((await GET(new Request('https://my.anotto.app/api/documents/pending-count'))).status).toBe(
    500,
  );
});
