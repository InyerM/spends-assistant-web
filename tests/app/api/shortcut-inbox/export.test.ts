import { describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/shortcut-inbox/export/route';
import { AuthError } from '@/lib/api/server';

const { getUserClient, eq, range } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  eq: vi.fn(),
  range: vi.fn(),
}));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

describe('Shortcut inbox export', () => {
  it('exports private raw text only for the cookie-authenticated owner', async () => {
    const query = { eq, order: () => query, range };
    eq.mockReturnValue(query);
    range.mockResolvedValue({
      data: [{ id: 'a', raw_text: 'synthetic private message' }],
      error: null,
    });
    getUserClient.mockResolvedValue({
      userId: 'owner-a',
      supabase: { from: () => ({ select: () => query }) },
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(eq).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect((await response.json()).items[0].raw_text).toBe('synthetic private message');
  });

  it('rejects export without a browser session', async () => {
    getUserClient.mockRejectedValue(new AuthError());
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get('content-disposition')).toBeNull();
  });
});
