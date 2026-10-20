import { expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: () => Promise.resolve({ supabase: { rpc }, userId: 'owner' }),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { GET } from '@/app/api/categories/usage/route';
it('gets category references from the authenticated SQL scope without accepting an owner parameter', async () => {
  const used_ids = ['00000000-0000-4000-8000-000000000001'];
  rpc.mockResolvedValueOnce({ data: { used_ids }, error: null });
  const response = await GET();
  expect(await response.json()).toEqual({ used_ids });
  expect(rpc).toHaveBeenCalledWith('category_usage_summary');
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'Unavailable' } });
  expect((await GET()).status).toBe(503);
});
