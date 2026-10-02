import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/documents/[id]/decisions/route';

const { getUserClient, rpc, observationQuery } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  rpc: vi.fn(),
  observationQuery: vi.fn(),
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const observationId = '20000000-0000-4000-8000-000000000001';
const transactionId = '30000000-0000-4000-8000-000000000001';
const key = '40000000-0000-4000-8000-000000000001';

function request(body: unknown): Request {
  return new Request('http://localhost/api/documents/doc-1/decisions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST document observation decision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({
      supabase: {
        rpc,
        from: () => ({
          select: () => ({
            eq: () => ({ eq: () => ({ eq: () => ({ single: observationQuery }) }) }),
          }),
        }),
      },
      userId: 'user-1',
    });
    observationQuery.mockResolvedValue({ data: { id: observationId }, error: null });
    rpc.mockResolvedValue({ data: 'decision-1', error: null });
  });

  it('submits only an explicit reviewed link through the owner-checked RPC', async () => {
    const response = await POST(
      request({
        observation_id: observationId,
        action: 'accept',
        transaction_id: transactionId,
        idempotency_key: key,
      }),
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ decision_id: 'decision-1' });
    expect(rpc).toHaveBeenCalledWith('decide_document_observation', {
      p_observation_id: observationId,
      p_action: 'accept',
      p_transaction_id: transactionId,
      p_idempotency_key: key,
    });
    expect(observationQuery).toHaveBeenCalledOnce();
  });

  it('rejects invalid action and missing idempotency key without calling RPC', async () => {
    const response = await POST(
      request({ observation_id: observationId, action: 'accept', transaction_id: transactionId }),
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a conflicting decision to 409', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'Observation is not pending review' },
    });
    const response = await POST(
      request({
        observation_id: observationId,
        action: 'accept',
        transaction_id: transactionId,
        idempotency_key: key,
      }),
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(409);
  });

  it('does not call the RPC for an observation outside the requested owner document', async () => {
    observationQuery.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const response = await POST(
      request({
        observation_id: observationId,
        action: 'accept',
        transaction_id: transactionId,
        idempotency_key: key,
      }),
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('records an explicit rejection without a transaction id', async () => {
    const response = await POST(
      request({
        observation_id: observationId,
        action: 'reject_observation',
        transaction_id: null,
        idempotency_key: key,
        reason: 'duplicate_capture',
      }),
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'decide_document_observation_with_reason',
      expect.objectContaining({
        p_action: 'reject_observation',
        p_transaction_id: null,
        p_reason: 'duplicate_capture',
      }),
    );
  });

  it('requires a preset reason when rejecting', async () => {
    const response = await POST(
      request({
        observation_id: observationId,
        action: 'reject_observation',
        idempotency_key: key,
        reason: 'guessed',
      }),
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
