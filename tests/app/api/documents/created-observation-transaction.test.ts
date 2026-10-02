import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/documents/[id]/observations/[observationId]/route';

const { getUserClient, observation, transactions } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  observation: vi.fn(),
  transactions: vi.fn(),
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const documentId = '11111111-1111-4111-8111-111111111111';
const observationId = '22222222-2222-4222-8222-222222222222';
const context = { params: Promise.resolve({ id: documentId, observationId }) };

describe('created document transaction recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observation.mockResolvedValue({ data: { id: observationId }, error: null });
    transactions.mockResolvedValue({
      data: [{ id: '33333333-3333-4333-8333-333333333333' }],
      error: null,
    });
    const observationQuery = { eq: vi.fn(), single: observation };
    observationQuery.eq.mockReturnValue(observationQuery);
    const transactionQuery = { eq: vi.fn(), contains: vi.fn(), is: vi.fn(), limit: transactions };
    transactionQuery.eq.mockReturnValue(transactionQuery);
    transactionQuery.contains.mockReturnValue(transactionQuery);
    transactionQuery.is.mockReturnValue(transactionQuery);
    getUserClient.mockResolvedValue({
      userId: 'owner',
      supabase: {
        from: vi.fn((table: string) => ({
          select: vi.fn(() =>
            table === 'document_observations' ? observationQuery : transactionQuery,
          ),
        })),
      },
    });
  });

  it('returns an owned existing transaction so approval can retry its document link', async () => {
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      transaction_id: '33333333-3333-4333-8333-333333333333',
    });
    const client = (await getUserClient.mock.results[0].value).supabase;
    const transactionQuery = client.from('transactions').select('id');
    expect(transactionQuery.contains).toHaveBeenCalledWith('parsed_data', {
      document_id: documentId,
      observation_id: observationId,
    });
  });

  it('does not disclose transactions for an observation outside the owner document', async () => {
    observation.mockResolvedValueOnce({ data: null, error: null });
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(404);
  });

  it('refuses an ambiguous recovery with multiple created transactions', async () => {
    transactions.mockResolvedValueOnce({ data: [{ id: 'one' }, { id: 'two' }], error: null });
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(409);
  });
});
