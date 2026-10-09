import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/financial-chat/route';
const mocks = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  AuthError: class AuthError extends Error {},
  getUserClient: mocks.getUserClient,
  errorResponse: (error: string, status: number) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.example' } }));
describe('financial chat proxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getUserClient.mockResolvedValue({ accessToken: 'owner-jwt' });
  });
  const request = () =>
    new Request('https://panel.example/api/financial-chat', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Spending?',
        month: '2026-10',
        corpusAcknowledged: true,
        user_id: 'attacker',
      }),
    });
  it('forwards only validated fields and authenticated token, without caching', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ answer: 'Recorded data', citations: [], coverage: {} }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://worker.example/financial/chat');
    expect(init.headers.Authorization).toBe('Bearer owner-jwt');
    expect(JSON.parse(String(init.body))).toEqual({
      question: 'Spending?',
      month: '2026-10',
      corpusAcknowledged: true,
    });
  });
  it('blocks cross-origin cookie requests', async () => {
    mocks.getUserClient.mockResolvedValue({
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'owner-jwt' } } }) },
      },
    });
    expect((await POST(request())).status).toBe(403);
  });
  it('preserves quota and consent status without upstream error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'private upstream text' }, { status: 429 })),
    );
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(JSON.stringify(await response.json())).not.toContain('private upstream');
  });
});
