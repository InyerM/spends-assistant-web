import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '@/app/api/settings/profile/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(m = 'Unauthorized') {
      super(m);
      this.name = 'AuthError';
    }
  },
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

describe('Settings Profile API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/settings/profile', () => {
    it('returns user profile data', async () => {
      const { getUserClient } = await import('@/lib/api/server');
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: {
                user: {
                  id: 'user-1',
                  email: 'test@test.com',
                  user_metadata: { display_name: 'Test User', avatar_url: null },
                  app_metadata: { providers: ['email'] },
                  created_at: '2024-01-01T00:00:00Z',
                },
              },
            }),
          },
        } as never,
        userId: 'user-1',
      });

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.email).toBe('test@test.com');
      expect(body.display_name).toBe('Test User');
    });

    it('returns 401 when no user found', async () => {
      const { getUserClient } = await import('@/lib/api/server');
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: {
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
          },
        } as never,
        userId: 'user-1',
      });

      const response = await GET();
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/settings/profile', () => {
    it('updates display_name', async () => {
      const { getUserClient } = await import('@/lib/api/server');
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: {
          auth: {
            updateUser: vi.fn().mockResolvedValue({
              data: {
                user: {
                  id: 'user-1',
                  email: 'test@test.com',
                  user_metadata: { display_name: 'New Name', avatar_url: null },
                  app_metadata: { providers: ['email'] },
                  created_at: '2024-01-01T00:00:00Z',
                },
              },
              error: null,
            }),
          },
        } as never,
        userId: 'user-1',
      });

      const request = new NextRequest('http://localhost/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: 'New Name' }),
      });
      const response = await PATCH(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.display_name).toBe('New Name');
    });
  });
});
