import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/investments/route';
import { getUserClient } from '@/lib/api/server';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const requestId = '00000000-0000-4000-8000-000000000111';
const positionId = '00000000-0000-4000-8000-000000000222';
const event = {
  action: 'buy',
  position_id: positionId,
  occurred_on: '2026-09-28',
  quantity_atoms: '1000000000000000000',
  gross_minor: '100000',
  fee_minor: '125',
  evidence: { kind: 'manual_review', reference: 'Tyba statement row 3', observed_on: '2026-09-28' },
};

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest('http://localhost/api/investments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
}

describe('/api/investments', () => {
  const rpc = vi.fn();
  const eq = vi.fn();
  const order = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    order.mockResolvedValue({ data: [], error: null });
    eq.mockReturnValue({ order });
    vi.mocked(getUserClient).mockResolvedValue({
      userId: 'user-1',
      supabase: { rpc, from: vi.fn(() => ({ select: () => ({ eq }) })) } as never,
    });
  });

  it('requires explicit review before writing', async () => {
    const response = await post({ request_id: requestId, reviewed: false, event });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects decimal money and quantity strings that can lose precision', async () => {
    const response = await post({
      request_id: requestId,
      reviewed: true,
      event: { ...event, quantity_atoms: '1.000000000000000001', gross_minor: '100.25' },
    });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects an impossible evidence date before the RPC', async () => {
    const response = await post({
      request_id: requestId,
      reviewed: true,
      event: { ...event, evidence: { ...event.evidence, observed_on: '2026-02-30' } },
    });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends reviewed integer strings to the idempotent RPC', async () => {
    rpc.mockResolvedValue({ data: { id: 'trade-1', replayed: false }, error: null });
    const response = await post({ request_id: requestId, reviewed: true, event });
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('confirm_investment_event', {
      p_request_id: requestId,
      p_reviewed: true,
      p_event: event,
    });
  });

  it('accepts a Binance position quoted in USDT with an explicit money scale', async () => {
    rpc.mockResolvedValue({ data: { id: positionId, replayed: false }, error: null });
    const createEvent = {
      action: 'create_position',
      provider: 'binance',
      symbol: 'BTC',
      quote_currency: 'USDT',
      quantity_scale: 18,
      money_scale: 6,
      evidence: event.evidence,
    };
    const response = await post({ request_id: requestId, reviewed: true, event: createEvent });
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('confirm_investment_event', {
      p_request_id: requestId,
      p_reviewed: true,
      p_event: createEvent,
    });
  });

  it('requires explicit acknowledgement when an opening lot has a known zero basis', async () => {
    rpc.mockResolvedValue({ data: { id: 'opening-1', replayed: false }, error: null });
    const opening = {
      action: 'opening',
      position_id: positionId,
      occurred_on: '2026-09-28',
      quantity_atoms: '100',
      cost_basis_minor: '0',
      evidence: event.evidence,
    };
    expect((await post({ request_id: requestId, reviewed: true, event: opening })).status).toBe(
      400,
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(
      (
        await post({
          request_id: requestId,
          reviewed: true,
          event: { ...opening, known_zero_basis: true },
        })
      ).status,
    ).toBe(201);
  });

  it('reports a replay without creating a second entry', async () => {
    rpc.mockResolvedValue({ data: { id: 'trade-1', replayed: true }, error: null });
    const response = await post({ request_id: requestId, reviewed: true, event });
    expect(response.status).toBe(200);
    expect((await response.json()).replayed).toBe(true);
  });

  it('scopes the read to the authenticated owner', async () => {
    expect((await GET()).status).toBe(200);
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
