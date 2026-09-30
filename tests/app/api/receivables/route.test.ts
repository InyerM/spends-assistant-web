import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/receivables/route';
import { getUserClient } from '@/lib/api/server';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const receivableId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const transactionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const event = {
  action: 'repayment',
  receivable_id: receivableId,
  source_transaction_id: transactionId,
  occurred_on: '2026-05-19',
  amount_minor: '100000',
  evidence_reference: 'Owner-confirmed principal repayment',
};
const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/receivables', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

describe('/api/receivables', () => {
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

  it('rejects unreviewed, unlinked and fractional principal entries', async () => {
    expect((await post({ request_id: requestId, reviewed: false, event })).status).toBe(400);
    expect(
      (
        await post({
          request_id: requestId,
          reviewed: true,
          event: { ...event, source_transaction_id: undefined },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post({
          request_id: requestId,
          reviewed: true,
          event: { ...event, amount_minor: '100000.25' },
        })
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes exact reviewed principal and a source transaction to the RPC', async () => {
    rpc.mockResolvedValue({ data: { id: 'event-1', replayed: false }, error: null });
    const response = await post({ request_id: requestId, reviewed: true, event });
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('confirm_receivable_event', {
      p_request_id: requestId,
      p_reviewed: true,
      p_event: event,
    });
  });

  it('keeps replay status and owner-scoped private reads', async () => {
    rpc.mockResolvedValue({ data: { id: 'event-1', replayed: true }, error: null });
    expect((await post({ request_id: requestId, reviewed: true, event })).status).toBe(200);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(eq).toHaveBeenCalledWith('user_id', 'owner-1');
  });

  it('accepts an empty receivable shell without inventing a principal amount', async () => {
    rpc.mockResolvedValue({ data: { id: receivableId, replayed: false }, error: null });
    expect(
      (
        await post({
          request_id: requestId,
          reviewed: true,
          event: {
            action: 'create_receivable',
            borrower: 'Brother',
            label: 'May personal loan',
            currency: 'COP',
            money_scale: 0,
          },
        })
      ).status,
    ).toBe(201);
  });
});
