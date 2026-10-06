import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getKeys, POST as createKey, DELETE as deleteKey } from '@/app/api/api-keys/route';
import { GET as getSessions, DELETE as deleteSession } from '@/app/api/settings/sessions/route';
import { GET as getSettings, PATCH as patchSettings } from '@/app/api/settings/user-settings/route';
import { GET as getProfile } from '@/app/api/settings/profile/route';
import { createMockSupabase } from '@/tests/__test-helpers__/factories';

const { getUserClient } = vi.hoisted(() => ({ getUserClient: vi.fn() }));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {
    constructor() {
      super('Unauthorized');
      this.name = 'AuthError';
    }
  },
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

vi.mock('@/lib/utils/api-key', () => ({
  generateApiKey: () => 'sk_test-key',
  hashApiKey: async () => 'test-hash',
}));

function mobileRequest(path: string, method = 'GET', body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: 'Bearer valid-mobile-jwt',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('mobile Bearer access to account settings routes', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase({
      id: 'item-1',
      user_id: 'owner-1',
      name: 'iPhone',
      hour_format: '12h',
      show_api_keys: true,
    });
    Object.assign(mockSupabase._chain, { upsert: vi.fn().mockReturnValue(mockSupabase._chain) });
    getUserClient.mockResolvedValue({
      userId: 'owner-1',
      supabase: {
        ...mockSupabase,
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'owner-1',
                email: 'owner@example.test',
                user_metadata: {},
                app_metadata: {},
                created_at: '2026-01-01T00:00:00Z',
              },
            },
          }),
        },
      },
    });
  });

  it.each([
    ['list API keys', getKeys, mobileRequest('/api/api-keys')],
    ['create API key', createKey, mobileRequest('/api/api-keys', 'POST', { name: 'iPhone' })],
    ['delete API key', deleteKey, mobileRequest('/api/api-keys?id=key-1', 'DELETE')],
    ['list sessions', getSessions, mobileRequest('/api/settings/sessions')],
    [
      'remove session metadata',
      deleteSession,
      mobileRequest('/api/settings/sessions?id=s-1', 'DELETE'),
    ],
    ['read preferences', getSettings, mobileRequest('/api/settings/user-settings')],
    [
      'update preferences',
      patchSettings,
      mobileRequest('/api/settings/user-settings', 'PATCH', { hour_format: '24h' }),
    ],
    ['read profile', getProfile, mobileRequest('/api/settings/profile')],
  ] as const)('passes the incoming request when it must %s', async (_label, handler, request) => {
    const response = await handler(request);

    expect(response.status).toBeLessThan(400);
    expect(getUserClient).toHaveBeenCalledWith(request);
  });

  it('rejects an invalid Bearer token instead of falling back to browser cookies', async () => {
    const { AuthError } = await import('@/lib/api/server');
    getUserClient.mockRejectedValue(new AuthError());

    const response = await getKeys(mobileRequest('/api/api-keys'));

    expect(response.status).toBe(401);
    expect(getUserClient).toHaveBeenCalledWith(expect.any(NextRequest));
  });

  it('uses the validated access token when reading a mobile profile', async () => {
    const readUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'owner-1',
          email: 'owner@example.test',
          user_metadata: {},
          app_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        },
      },
    });
    getUserClient.mockResolvedValue({
      userId: 'owner-1',
      accessToken: 'valid-mobile-jwt',
      supabase: { auth: { getUser: readUser } },
    });

    const response = await getProfile(mobileRequest('/api/settings/profile'));

    expect(response.status).toBe(200);
    expect(readUser).toHaveBeenCalledWith('valid-mobile-jwt');
  });

  it.each([
    ['API key', deleteKey, '/api/api-keys?id=key-1'],
    ['device record', deleteSession, '/api/settings/sessions?id=s-1'],
  ] as const)('scopes %s deletion to the authenticated owner', async (_label, handler, path) => {
    await handler(mobileRequest(path, 'DELETE'));

    expect(mockSupabase._chain.eq).toHaveBeenCalledWith('user_id', 'owner-1');
  });
});
