import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/audio/transcribe/route';
const mocks = vi.hoisted(() => ({ client: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: mocks.client,
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.test' } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockResolvedValue(Response.json({ text: 'Synthetic transcript' }));
  mocks.client.mockResolvedValue({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: 'owner-token' } } }) },
    },
  });
});
it('rejects a cookie-authenticated cross-origin transcription before contacting the worker', async () => {
  const response = await POST(
    new Request('https://anotto.test/api/audio/transcribe', {
      method: 'POST',
      headers: { Origin: 'https://foreign.test' },
      body: '{}',
    }),
  );
  expect(response.status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('proxies an owner request without storing or caching the audio', async () => {
  const response = await POST(
    new Request('https://anotto.test/api/audio/transcribe', {
      method: 'POST',
      headers: { Origin: 'https://anotto.test' },
      body: '{"data":"UklGRg==","format":"wav","language":"en"}',
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ text: 'Synthetic transcript' });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer owner-token');
});
