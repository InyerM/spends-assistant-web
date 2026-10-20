import { expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: async () => ({ accessToken: 'token', supabase: { rpc } }),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { POST } from '@/app/api/documents/[id]/review-status/route';
it('accepts only workflow status and delegates the owner decision to SQL', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const send = (body: unknown) =>
    POST(new Request('https://app.test/review', { method: 'POST', body: JSON.stringify(body) }), {
      params: Promise.resolve({ id }),
    });
  expect((await send({ status: 'completed' })).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('set_document_review_status', {
    p_document: id,
    p_status: 'completed',
  });
  expect((await send({ status: 'completed', amount: 1 })).status).toBe(400);
});
