import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/documents/[id]/extract/route';

const { getUserClient, fetchMock, documentQuery, download, rpc, update, documentUpdate } =
  vi.hoisted(() => ({
    getUserClient: vi.fn(),
    fetchMock: vi.fn(),
    documentQuery: vi.fn(),
    download: vi.fn(),
    rpc: vi.fn(),
    update: vi.fn(),
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
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'claim_document_extraction'
          ? { data: true, error: null }
          : { data: 1, error: null },
      ),
    );
    documentUpdate.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq: () => ({ eq: () => ({ eq: documentUpdate }) }) });
    getUserClient.mockResolvedValue({
      userId: 'user-1',
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-1' } } }) },
        storage: { from: () => ({ download }) },
        rpc,
        from: () => ({
          select: () => ({ eq: () => ({ eq: () => ({ single: documentQuery }) }) }),
          update,
        }),
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
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
    expect(rpc.mock.calls[0]).toEqual(['claim_document_extraction', { p_document_id: 'doc-1' }]);
    expect(rpc.mock.calls[1][0]).toBe('complete_document_extraction');
    expect(rpc.mock.calls[1][1].p_observations[0]).toMatchObject({
      description: 'Coffee',
    });
    expect(JSON.stringify(rpc.mock.calls[1][1])).not.toContain('transaction_id');
    expect(JSON.stringify(rpc.mock.calls[1][1])).not.toContain('usage');
  });

  it('rejects extraction of another user document', async () => {
    documentQuery.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'other' }),
    });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns conflict before download or Worker call when another extraction holds the claim', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(409);
    expect(download).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(documentUpdate).not.toHaveBeenCalled();
  });

  it('starts only one Worker request for simultaneous extraction attempts', async () => {
    let claims = 0;
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'claim_document_extraction'
          ? { data: ++claims === 1, error: null }
          : { data: 0, error: null },
      ),
    );
    fetchMock.mockResolvedValue(
      Response.json({
        draft: { document_type: 'other', observations: [] },
        model: 'qwen',
        usage: {},
      }),
    );
    const context = { params: Promise.resolve({ id: 'doc-1' }) };
    const responses = await Promise.all([
      POST(new Request('http://localhost') as never, context),
      POST(new Request('http://localhost') as never, context),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('marks the claimed document failed if the private image cannot be downloaded', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(400);
    expect(documentUpdate).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('leaves no extracted result when atomic completion fails', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        draft: { document_type: 'other', observations: [] },
        model: 'qwen',
        usage: {},
      }),
    );
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'claim_document_extraction'
          ? { data: true, error: null }
          : { data: null, error: { message: 'database unavailable' } },
      ),
    );
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(500);
    expect(documentUpdate).toHaveBeenCalled();
  });

  it('marks malformed Worker JSON as an invalid response', async () => {
    fetchMock.mockResolvedValue(new Response('{bad json', { status: 200 }));
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(502);
    expect(update).toHaveBeenCalledWith({ status: 'failed', error_code: 'INVALID_RESPONSE' });
  });
});
