import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from '@/app/api/email-forwarding/route';
import { getUserClient } from '@/lib/api/server';

vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.example', apiKey: '' } }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const activeRoute = {
  status: 'active',
  address: 'private@example.com',
  created_at: '2026-10-01T00:00:00Z',
  confirmation_received_at: null,
  verification_text: null,
};

describe('/api/email-forwarding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUserClient).mockResolvedValue({
      userId: 'user-1',
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: { session: { access_token: 'session-token' } },
          }),
        },
      } as never,
    });
  });

  it('forwards an authenticated read with private caching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'unconfigured' }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ status: 'unconfigured' });
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/email-forwarding-route', {
      method: 'GET',
      headers: { Authorization: 'Bearer session-token' },
      cache: 'no-store',
    });
  });

  it('provisions the route without sending user supplied data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(activeRoute, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST();

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(activeRoute);
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('passes through a successful removal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const response = await DELETE();

    expect(response.status).toBe(204);
  });

  it('rejects requests without an authenticated session', async () => {
    vi.mocked(getUserClient).mockResolvedValue({
      userId: 'user-1',
      supabase: {
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      } as never,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect((await GET()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
