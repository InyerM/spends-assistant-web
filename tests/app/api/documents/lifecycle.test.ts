import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH as archive } from '@/app/api/documents/[id]/route';
import { POST as restore } from '@/app/api/documents/[id]/observations/[observationId]/restore/route';

const { getUserClient, rpc, single } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  rpc: vi.fn(),
  single: vi.fn(),
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const documentId = '10000000-0000-4000-8000-000000000001';
const observationId = '20000000-0000-4000-8000-000000000001';
const params = { params: Promise.resolve({ id: documentId, observationId }) };

describe('document lifecycle routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({
      userId: 'owner',
      supabase: {
        rpc,
        from: () => ({
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ single }) }) }) }),
        }),
      },
    });
    single.mockResolvedValue({ data: { id: observationId }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it('archives a capture using the owner-scoped RPC', async () => {
    const response = await archive(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      }),
      params,
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('set_document_archived', {
      p_document_id: documentId,
      p_archived: true,
    });
  });

  it('reports a pending created transaction as an archive conflict', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'Document has a created transaction requiring link review' },
    });
    const response = await archive(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      }),
      params,
    );
    expect(response.status).toBe(409);
  });

  it('restores only an observation in the requested document', async () => {
    single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    const response = await restore(new Request('http://localhost', { method: 'POST' }), params);
    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls the audited restore RPC for an owned observation', async () => {
    const response = await restore(new Request('http://localhost', { method: 'POST' }), params);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('restore_document_observation', {
      p_observation_id: observationId,
    });
  });
});
