import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/loans/route';
import { getUserClient } from '@/lib/api/server';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const id = '00000000-0000-4000-8000-000000000111';
const evidence = {
  kind: 'statement',
  reference: 'Bank statement page 1',
  observed_on: '2026-09-28',
};
const payment = {
  action: 'payment',
  loan_id: id,
  occurred_on: '2026-09-28',
  cash_paid_minor: '12345',
  principal_minor: '10000',
  interest_minor: '2000',
  insurance_minor: '300',
  fee_minor: '45',
  evidence,
};
const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/loans', { method: 'POST', body: JSON.stringify(body) }),
  );

describe('/api/loans', () => {
  const rpc = vi.fn();
  const eq = vi.fn();
  const order = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    order.mockResolvedValue({ data: [], error: null });
    eq.mockReturnValue({ order });
    vi.mocked(getUserClient).mockResolvedValue({
      userId: 'owner-1',
      supabase: { rpc, from: vi.fn(() => ({ select: () => ({ eq }) })) } as never,
    });
  });
  it('rejects unreviewed and inferred payment allocations', async () => {
    expect((await post({ request_id: id, reviewed: false, event: payment })).status).toBe(400);
    expect(
      (
        await post({
          request_id: id,
          reviewed: true,
          event: { ...payment, interest_minor: undefined },
        })
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('preserves exact unit strings in the reviewed RPC', async () => {
    rpc.mockResolvedValue({ data: { id, replayed: false }, error: null });
    expect((await post({ request_id: id, reviewed: true, event: payment })).status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('confirm_loan_event', {
      p_request_id: id,
      p_reviewed: true,
      p_event: payment,
    });
  });
  it('rejects payment sums that do not match cash paid', async () => {
    expect(
      (
        await post({
          request_id: id,
          reviewed: true,
          event: { ...payment, cash_paid_minor: '12344' },
        })
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('keeps replay status and scopes owner reads', async () => {
    rpc.mockResolvedValue({ data: { id, replayed: true }, error: null });
    expect((await post({ request_id: id, reviewed: true, event: payment })).status).toBe(200);
    expect((await GET()).status).toBe(200);
    expect(eq).toHaveBeenCalledWith('user_id', 'owner-1');
  });
  it('accepts a loan without an invented opening balance or rate', async () => {
    rpc.mockResolvedValue({ data: { id, replayed: false }, error: null });
    const event = {
      action: 'create_loan',
      lender: 'lulo_bank',
      label: 'Personal loan',
      currency: 'COP',
      money_scale: 0,
      evidence,
    };
    expect((await post({ request_id: id, reviewed: true, event })).status).toBe(201);
  });
});
