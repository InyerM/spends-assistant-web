import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/transactions/[id]/route';
import { applyTransactionBalance, getUserClient } from '@/lib/api/server';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
  applyTransactionBalance: vi.fn(),
}));

const id = '11111111-1111-4111-8111-111111111111';
const account = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id }) };

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

describe('atomic transaction PATCH route', () => {
  const rpc = vi.fn();
  const from = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUserClient).mockResolvedValue({
      userId: 'owner',
      supabase: { rpc, from } as never,
    });
  });

  it('sends allowed fields to the owner-scoped RPC without a separate balance write', async () => {
    rpc.mockResolvedValue({ data: { id, amount: 150 }, error: null });
    const response = await PATCH(request({ amount: 150, account_id: account }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id, amount: 150 });
    expect(rpc).toHaveBeenCalledWith('patch_reviewed_transaction', {
      p_transaction_id: id,
      p_patch: { amount: 150, account_id: account },
    });
    expect(from).not.toHaveBeenCalled();
    expect(applyTransactionBalance).not.toHaveBeenCalled();
  });

  it('rejects arbitrary provenance fields before touching the database', async () => {
    for (const body of [
      { source: 'web' },
      { user_id: id },
      { deleted_at: null },
      { is_reconciled: true },
      {},
    ]) {
      expect((await PATCH(request(body), context)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects invalid financial amounts and transfer IDs before the RPC', async () => {
    expect((await PATCH(request({ amount: -1 }), context)).status).toBe(400);
    expect((await PATCH(request({ transfer_to_account_id: 'foreign' }), context)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns conflict for a reviewed match and hides missing owner rows', async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '23514',
          message: 'Reviewed document or Shortcut match blocks transaction edits',
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'P0002', message: 'Transaction not found' },
      });
    expect((await PATCH(request({ description: 'Changed' }), context)).status).toBe(409);
    expect((await PATCH(request({ description: 'Changed' }), context)).status).toBe(404);
  });
});
