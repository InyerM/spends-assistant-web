import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shortcut-inbox/[id]/create/route';
import { AuthError } from '@/lib/api/server';

const { getUserClient, rpc } = vi.hoisted(() => ({ getUserClient: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const inboxId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const context = { params: Promise.resolve({ id: inboxId }) };
const reviewed = {
  account_id: accountId,
  category_id: categoryId,
  type: 'expense',
  amount: '1200.50',
  date: '2026-09-28',
  description: 'Reviewed market expense',
};
const request = (body: unknown): Request =>
  new Request(`https://example.test/api/shortcut-inbox/${inboxId}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Shortcut reviewed transaction creation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({ userId: 'owner-a', supabase: { rpc } });
    rpc.mockResolvedValue({
      data: {
        status: 'created',
        transaction_id: 'tx-1',
        decision_id: 'decision-1',
        replayed: false,
      },
      error: null,
    });
  });

  it('sends exact decimal text and reviewed fields to one database RPC', async () => {
    const response = await POST(request(reviewed) as never, context);
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('confirm_shortcut_transaction', {
      p_inbox_item_id: inboxId,
      p_reviewed_payload: reviewed,
      p_reviewed_candidate_hash: '',
      p_confirm_distinct: false,
    });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('passes an explicitly confirmed original event instant into the immutable review payload', async () => {
    const eventReview = {
      ...reviewed,
      event_at: '2026-09-28T04:40:00-05:00',
      event_time_confirmed: true,
    };
    const response = await POST(request(eventReview) as never, context);
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith(
      'confirm_shortcut_transaction',
      expect.objectContaining({ p_reviewed_payload: eventReview }),
    );
  });

  it('rejects unsupported or unconfirmed event times before reaching the database', async () => {
    for (const body of [
      { ...reviewed, event_at: '2026-09-28T04:40:00-05:00' },
      { ...reviewed, event_time_confirmed: true },
      { ...reviewed, event_at: '2026-09-28T04:40:00-05:00', event_time_confirmed: false },
      { ...reviewed, event_at: '2026-09-28T04:40:00', event_time_confirmed: true },
      { ...reviewed, event_at: '2026-09-27T23:50:00-05:00', event_time_confirmed: true },
      { ...reviewed, event_at: '2026-02-30T04:40:00-05:00', event_time_confirmed: true },
    ]) {
      expect((await POST(request(body) as never, context)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns owner-scoped live candidate review without creating a row', async () => {
    rpc.mockResolvedValue({
      data: {
        status: 'review_required',
        candidates: [{ id: 'tx-1' }],
        candidate_hash: 'a'.repeat(32),
        candidate_count: 1,
      },
      error: null,
    });
    const response = await POST(request(reviewed) as never, context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ status: 'review_required', candidate_count: 1 });
    rpc.mockResolvedValue({ data: { status: 'created', replayed: false }, error: null });
    const confirmed = await POST(
      request({
        ...reviewed,
        reviewed_candidate_hash: 'a'.repeat(32),
        confirm_distinct: true,
      }) as never,
      context,
    );
    expect(confirmed.status).toBe(201);
    expect(rpc).toHaveBeenLastCalledWith(
      'confirm_shortcut_transaction',
      expect.objectContaining({
        p_reviewed_candidate_hash: 'a'.repeat(32),
        p_confirm_distinct: true,
      }),
    );
  });

  it('returns a bounded overflow response and does not treat it as a created transaction', async () => {
    rpc.mockResolvedValue({
      data: {
        status: 'review_overflow',
        candidate_count: 21,
        candidates: Array.from({ length: 20 }, (_, index) => ({ id: `tx-${index}` })),
      },
      error: null,
    });
    const response = await POST(request(reviewed) as never, context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ status: 'review_overflow', candidate_count: 21 });
  });

  it('rejects forged owner, invalid amount/date/type and malformed IDs before RPC', async () => {
    for (const body of [
      { ...reviewed, user_id: 'other' },
      { ...reviewed, amount: 1200.5 },
      { ...reviewed, amount: '0' },
      { ...reviewed, amount: '1.234' },
      { ...reviewed, date: '2026-02-30' },
      { ...reviewed, type: 'transfer' },
      { ...reviewed, category_id: 'bad' },
      { ...reviewed, confirm_distinct: true },
    ]) {
      expect((await POST(request(body) as never, context)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps account/category, quota, conflict and auth errors without returning private details', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } });
    expect((await POST(request(reviewed) as never, context)).status).toBe(404);
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001' } });
    expect((await POST(request(reviewed) as never, context)).status).toBe(403);
    rpc.mockResolvedValue({ data: null, error: { code: '23505' } });
    expect((await POST(request(reviewed) as never, context)).status).toBe(409);
    getUserClient.mockRejectedValue(new AuthError());
    expect((await POST(request(reviewed) as never, context)).status).toBe(401);
  });
});
