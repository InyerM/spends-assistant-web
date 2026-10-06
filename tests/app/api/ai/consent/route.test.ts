import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/ai/consent/route';

const mocks = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  AuthError: class AuthError extends Error {},
  getUserClient: mocks.getUserClient,
  errorResponse: (error: string, status: number) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.example' } }));

const state = {
  version: 'external-ai-v1',
  consents: { financial_text: false, document_images: false, forwarded_email: false },
};
const post = (body: unknown, origin = 'https://panel.example') =>
  new Request('https://panel.example/api/ai/consent', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('/api/ai/consent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getUserClient.mockResolvedValue({ accessToken: 'user-jwt' });
  });

  it('loads owner consent using the authenticated token and never caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(state));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(new Request('https://panel.example/api/ai/consent'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual(state);
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/ai/consent', {
      headers: { Authorization: 'Bearer user-jwt' },
    });
  });

  it('writes only the explicit scoped choice for the current version', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...state, consents: { ...state.consents, document_images: true } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      post({ scope: 'document_images', granted: true, version: 'external-ai-v1' }),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/ai/consent', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'document_images', granted: true, version: 'external-ai-v1' }),
    });
  });

  it('accepts an authenticated bearer request without a browser Origin header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(state));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://panel.example/api/ai/consent', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'forwarded_email', granted: false, version: 'external-ai-v1' }),
    });
    expect((await POST(request)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks cross-origin changes and invalid scopes before contacting the Worker', async () => {
    mocks.getUserClient.mockResolvedValue({
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'cookie-jwt' } } }) },
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await POST(
          post(
            { scope: 'document_images', granted: true, version: 'external-ai-v1' },
            'https://evil.example',
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (await POST(post({ scope: 'all', granted: true, version: 'external-ai-v1' }))).status,
    ).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed while the Worker endpoint is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Not found' }, { status: 404 })),
    );
    const response = await GET(new Request('https://panel.example/api/ai/consent'));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toEqual(state);
  });
});
