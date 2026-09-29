import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/documents/[id]/extract/route';

const { getUserClient, fetchMock, documentQuery, download, observationInsert, documentUpdate } =
  vi.hoisted(() => ({
    getUserClient: vi.fn(),
    fetchMock: vi.fn(),
    documentQuery: vi.fn(),
    download: vi.fn(),
    observationInsert: vi.fn(),
    documentUpdate: vi.fn(),
  }));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.test' } }));

describe('POST /api/documents/[id]/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    documentQuery.mockResolvedValue({
      data: {
        id: 'doc-1',
        file_path: 'user-1/image.png',
        mime_type: 'image/png',
        status: 'uploaded',
      },
      error: null,
    });
    download.mockResolvedValue({
      data: { arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer },
      error: null,
    });
    observationInsert.mockResolvedValue({ error: null });
    documentUpdate.mockResolvedValue({ error: null });
    getUserClient.mockResolvedValue({
      userId: 'user-1',
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-1' } } }) },
        storage: { from: () => ({ download }) },
        from: (table: string) =>
          table === 'documents'
            ? {
                select: () => ({ eq: () => ({ eq: () => ({ single: documentQuery }) }) }),
                update: () => ({ eq: documentUpdate }),
              }
            : { insert: observationInsert },
      },
    });
  });

  it('passes the JWT and saves observations as pending drafts', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        draft: {
          document_type: 'receipt',
          observations: [
            {
              amount: 1000,
              currency: 'COP',
              occurred_at: null,
              description: 'Coffee',
              counterparty: null,
              reference: null,
              source_excerpt: 'Coffee 1000',
              confidence: 0.8,
            },
          ],
        },
        model: 'qwen',
        usage: {},
      }),
    );
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-1');
    expect(observationInsert.mock.calls[0][0][0]).toMatchObject({
      status: 'pending',
      document_id: 'doc-1',
      description: 'Coffee',
    });
    expect(JSON.stringify(observationInsert.mock.calls[0][0])).not.toContain('transaction_id');
  });

  it('rejects extraction of another user document', async () => {
    documentQuery.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'other' }),
    });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
