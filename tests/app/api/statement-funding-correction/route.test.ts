import { expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: async () => ({ supabase: { rpc }, accessToken: 'token' }),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { POST } from '@/app/api/transactions/[id]/funding-correction/route';
const id = '00000000-0000-4000-8000-000000000001';
it('requires explicit expected and actual amounts and delegates to the atomic owner writer', async () => {
  rpc.mockResolvedValueOnce({ data: { transaction_id: id }, error: null });
  const request = (body: unknown) =>
    new Request('https://app.test/api/transactions/' + id + '/funding-correction', {
      method: 'POST',
      headers: { 'Idempotency-Key': id },
      body: JSON.stringify(body),
    });
  expect(
    (
      await POST(request({ expected_amount: 20000, actual_amount: 21000 }), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('correct_statement_funding_amount', {
    p_request_id: id,
    p_transaction_id: id,
    p_expected_amount: 20000,
    p_actual_amount: 21000,
  });
  expect(
    (
      await POST(request({ expected_amount: 20000, actual_amount: 21000, destination_amount: 6 }), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(400);
  rpc.mockResolvedValueOnce({
    error: {
      code: '23505',
      message: 'Possible existing funding debit; reconcile instead of duplicating',
    },
  });
  const duplicate = await POST(request({ expected_amount: 20000, actual_amount: 21000 }), {
    params: Promise.resolve({ id }),
  });
  expect(duplicate.status).toBe(409);
  expect((await duplicate.json()).code).toBe('FUNDING_DUPLICATE');
});
