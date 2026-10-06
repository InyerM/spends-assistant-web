import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/merchant-suggestions/route';

const mocks = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  AuthError: class AuthError extends Error {},
  getUserClient: mocks.getUserClient,
  errorResponse: (error: string, status: number) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.example' } }));

const request = (merchant: unknown, headers?: HeadersInit): Request =>
  new Request('https://app.example/api/merchant-suggestions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ merchant }),
  });

describe('POST /api/merchant-suggestions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getUserClient.mockResolvedValue({ userId: 'owner-1', accessToken: 'user-jwt' });
  });

  it('forwards only the merchant name with the verified user token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ category_id: 'shopping-id', source: 'ai' }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request('AMAZON.COM', { Authorization: 'Bearer user-jwt' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ category_id: 'shopping-id', source: 'ai' });
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/merchant/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user-jwt' },
      body: JSON.stringify({ merchant: 'AMAZON.COM' }),
    });
  });

  it('rejects invalid merchant names without provider calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await POST(request('a'))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cookie based cross-origin requests', async () => {
    mocks.getUserClient.mockResolvedValue({ userId: 'owner-1', supabase: {} });
    const response = await POST(request('AMAZON.COM', { Origin: 'https://attacker.example' }));
    expect(response.status).toBe(403);
  });

  it('preserves the Worker consent requirement for the client', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: 'AI_CONSENT_REQUIRED', scope: 'financial_text', version: 'external-ai-v1' },
            { status: 428 },
          ),
        ),
    );
    const response = await POST(request('Unknown merchant', { Authorization: 'Bearer user-jwt' }));
    expect(response.status).toBe(428);
    expect(await response.json()).toMatchObject({
      code: 'AI_CONSENT_REQUIRED',
      scope: 'financial_text',
    });
  });
});
