import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from '@/app/api/documents/[id]/observations/[observationId]/route';

const { getUserClient, single, rpc } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const documentId = '11111111-1111-4111-8111-111111111111';
const observationId = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id: documentId, observationId }) };
const request = (body: unknown): Request =>
  new Request('http://localhost/api/documents/review', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('review a document observation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({ data: { id: observationId }, error: null });
    rpc.mockResolvedValue({ data: { currency: 'COP', amount: -12000 }, error: null });
    const query = { eq: vi.fn() };
    query.eq.mockReturnValue(query);
    Object.assign(query, { single });
    getUserClient.mockResolvedValue({
      userId: 'owner',
      supabase: { from: vi.fn(() => ({ select: vi.fn(() => query) })), rpc },
    });
  });

  it('saves a reviewed COP correction for an owned observation', async () => {
    const response = await PATCH(
      request({
        amount: -12000,
        currency: 'COP',
        occurred_at_text: '2026-09-28',
        description: 'Lunch',
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('revise_document_observation', {
      p_observation_id: observationId,
      p_amount: -12000,
      p_currency: 'COP',
      p_occurred_at_text: '2026-09-28',
      p_description: 'Lunch',
    });
  });

  it('rejects missing ownership and invalid currency without calling the review RPC', async () => {
    single.mockResolvedValueOnce({ data: null, error: null });
    expect(
      (
        await PATCH(
          request({
            amount: -12000,
            currency: 'COP',
            occurred_at_text: '2026-09-28',
            description: 'Lunch',
          }),
          context,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await PATCH(
          request({
            amount: -12000,
            currency: 'US',
            occurred_at_text: '2026-09-28',
            description: 'Lunch',
          }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
