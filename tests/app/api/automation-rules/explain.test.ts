import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/automation-rules/explain/route';
const mocks = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: mocks.getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status: number) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.example/' } }));
describe('automation explanation proxy', () => {
  it('does not forward unauthenticated requests', async () => {
    mocks.getUserClient.mockResolvedValue({
      supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
    });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(
      (await POST(new Request('https://web.test/explain', { method: 'POST', body: '{}' }) as never))
        .status,
    ).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves consent requirements and forwards the owner bearer', async () => {
    mocks.getUserClient.mockResolvedValue({
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'owner-token' } } }) },
      },
    });
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ code: 'AI_CONSENT_REQUIRED', scope: 'financial_text' }, { status: 428 }),
      );
    vi.stubGlobal('fetch', fetch);
    const result = await POST(
      new Request('https://web.test/explain', {
        method: 'POST',
        body: JSON.stringify({ rule: { name: 'Coffee' }, locale: 'es' }),
      }) as never,
    );
    expect(result.status).toBe(428);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(fetch).toHaveBeenCalledWith(
      'https://worker.example/automation/explain',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer owner-token' }),
      }),
    );
  });
});
