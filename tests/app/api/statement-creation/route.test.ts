import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { getUserClient } from '@/lib/api/server';
import { POST } from '@/app/api/documents/[id]/reconciliation/create/route';
const rpc = vi.fn(),
  id = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'token',
    supabase: { rpc } as never,
  });
});
it('requires explicit valid evidence and delegates creation to one atomic owner command', async () => {
  const body = {
    request_id: id,
    observation_id: id,
    category_id: null,
    description: 'Reviewed fee',
  };
  rpc.mockResolvedValue({ data: { transaction_id: id }, error: null });
  const context = { params: Promise.resolve({ id }) };
  expect(
    (
      await POST(
        new Request('https://my.anotto.app/api/documents/' + id + '/reconciliation/create', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
        context,
      )
    ).status,
  ).toBe(201);
  expect(rpc).toHaveBeenCalledWith('create_statement_transaction', {
    p_request_id: id,
    p_document_id: id,
    p_observation_id: id,
    p_category_id: null,
    p_description: 'Reviewed fee',
    p_transfer_account_id: null,
  });
  expect(
    (
      await POST(
        new Request('https://my.anotto.app/api/documents/' + id + '/reconciliation/create', {
          method: 'POST',
          body: JSON.stringify({ ...body, amount: 1 }),
        }),
        context,
      )
    ).status,
  ).toBe(400);
  rpc.mockResolvedValue({ data: null, error: { code: '23505' } });
  const conflict = await POST(
    new Request('https://my.anotto.app/api/documents/' + id + '/reconciliation/create', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    context,
  );
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toMatchObject({ code: 'POSSIBLE_DUPLICATE' });
});
it('accepts the browser host behind the local server while rejecting a foreign origin', async () => {
  vi.mocked(getUserClient).mockResolvedValue({ userId: 'owner', supabase: { rpc } as never });
  rpc.mockResolvedValue({ data: { transaction_id: id }, error: null });
  const body = {
    request_id: id,
    observation_id: id,
    category_id: null,
    description: 'Reviewed fee',
  };
  const request = (origin: string) =>
    new Request('http://localhost:3027/api/documents/' + id + '/reconciliation/create', {
      method: 'POST',
      headers: { Host: '127.0.0.1:3027', Origin: origin },
      body: JSON.stringify(body),
    });
  expect(
    (await POST(request('http://127.0.0.1:3027'), { params: Promise.resolve({ id }) })).status,
  ).toBe(201);
  expect(
    (await POST(request('https://foreign.example'), { params: Promise.resolve({ id }) })).status,
  ).toBe(403);
});
