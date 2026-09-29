import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/transactions/route';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
  applyAutomationRules: vi.fn((_, tx) => Promise.resolve(tx)),
  applyTransactionBalance: vi.fn(),
}));

const tx = {
  id: 'created-id',
  date: '2026-09-28',
  time: '12:00',
  amount: 1200,
  description: 'Synthetic expense',
  account_id: 'account-id',
  type: 'expense',
  source: 'web',
};
const requestId = '77777777-7777-4777-8777-000000000001';
const replaceId = '88888888-8888-4888-8888-000000000001';

function request(path = '/api/transactions', headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId, ...headers },
    body: JSON.stringify(tx),
  });
}

describe('atomic manual transaction route', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('returns the created transaction from one owner-scoped RPC without direct financial writes', async () => {
    const { getUserClient, applyTransactionBalance } = await import('@/lib/api/server');
    const rpc = vi.fn().mockResolvedValue({
      data: { status: 'created', transaction: tx, replayed: false },
      error: null,
    });
    const from = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { rpc, from } as never,
      userId: 'user-id',
    });

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(tx);
    expect(rpc).toHaveBeenCalledWith('confirm_manual_transaction', {
      p_request_id: requestId,
      p_payload: tx,
      p_force: false,
      p_replace_id: null,
    });
    expect(from).not.toHaveBeenCalled();
    expect(applyTransactionBalance).not.toHaveBeenCalled();
  });

  it('passes force and replacement to the RPC without client-side balance changes', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { status: 'created', transaction: tx }, error: null });
    const from = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { rpc, from } as never,
      userId: 'user-id',
    });

    const response = await POST(request(`/api/transactions?force=true&replace=${replaceId}`));

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('confirm_manual_transaction', {
      p_request_id: requestId,
      p_payload: { ...tx, duplicate_status: 'confirmed' },
      p_force: true,
      p_replace_id: replaceId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('preserves the duplicate conflict response', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { status: 'duplicate', match: tx }, error: null });
    vi.mocked(getUserClient).mockResolvedValue({ supabase: { rpc } as never, userId: 'user-id' });

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ duplicate: true, match: tx });
  });

  it('maps quota and missing replacement errors without any follow-up writes', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'Transaction limit exceeded' } })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Replacement transaction not found' },
      });
    const from = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: { rpc, from } as never,
      userId: 'user-id',
    });

    expect((await POST(request())).status).toBe(403);
    expect((await POST(request(`/api/transactions?replace=${replaceId}`))).status).toBe(404);
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects a malformed idempotency key before invoking the RPC', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const rpc = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({ supabase: { rpc } as never, userId: 'user-id' });

    const response = await POST(request('/api/transactions', { 'Idempotency-Key': 'bad' }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('asks for review when automation adds a destination to a non-transfer', async () => {
    const { getUserClient, applyAutomationRules } = await import('@/lib/api/server');
    const rpc = vi.fn();
    vi.mocked(getUserClient).mockResolvedValue({ supabase: { rpc } as never, userId: 'user-id' });
    vi.mocked(applyAutomationRules).mockResolvedValueOnce({
      ...tx,
      transfer_to_account_id: 'destination-id',
    } as never);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'REVIEW_AUTOMATION_RULE' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
