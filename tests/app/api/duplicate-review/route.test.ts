import { expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: () => Promise.resolve({ accessToken: 'token', supabase: { rpc } }),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { POST } from '@/app/api/transactions/[id]/duplicate-review/route';
it('confirms the owned duplicate through SQL and rejects extra financial fields', async () => {
  rpc.mockResolvedValue({ error: null });
  const id = '00000000-0000-4000-8000-000000000001';
  const send = (body: unknown) =>
    POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), {
      params: Promise.resolve({ id }),
    });
  expect((await send({ action: 'keep' })).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('confirm_transaction_not_duplicate', { p_transaction: id });
  expect((await send({ action: 'keep', amount: 900 })).status).toBe(400);
  rpc.mockResolvedValueOnce({ error: { code: 'P0002' } });
  expect((await send({ action: 'keep' })).status).toBe(404);
});
