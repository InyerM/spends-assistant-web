import { describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/automation-rules/generate/route';

const mocks = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: mocks.getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status: number) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.example' } }));

describe('AI automation consent', () => {
  it('forwards a 428 financial text consent requirement', async () => {
    mocks.getUserClient.mockResolvedValue({
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'jwt' } } }) },
      },
    });
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
    const response = await POST(
      new Request('https://panel.example/api/automation-rules/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Categorize meals' }),
      }) as never,
    );
    expect(response.status).toBe(428);
    expect(await response.json()).toMatchObject({
      code: 'AI_CONSENT_REQUIRED',
      scope: 'financial_text',
    });
  });
});
