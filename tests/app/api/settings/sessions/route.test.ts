import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, DELETE } from '@/app/api/settings/sessions/route';
import { NextRequest } from 'next/server';
import { createMockSupabase } from '@/tests/__test-helpers__/factories';

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

describe('Settings Sessions API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/settings/sessions', () => {
    it('returns list of sessions', async () => {
      const sessions = [
        {
          id: 'sess-1',
          user_id: 'user-1',
          device_name: 'Chrome on macOS',
          device_type: 'desktop',
          browser: 'Chrome',
          os: 'macOS',
          ip_address: '192.168.1.1',
          last_active_at: '2024-01-15T10:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const { getUserClient } = await import('@/lib/api/server');
      const mock = createMockSupabase(sessions);
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: mock as never,
        userId: 'user-1',
      });

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(1);
      expect(body[0].device_name).toBe('Chrome on macOS');
    });
  });

  describe('DELETE /api/settings/sessions', () => {
    it('revokes a session by ID', async () => {
      const { getUserClient } = await import('@/lib/api/server');
      const mock = createMockSupabase(null);
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: mock as never,
        userId: 'user-1',
      });

      const request = new NextRequest('http://localhost/api/settings/sessions?id=sess-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it('returns 400 when id is missing', async () => {
      const { getUserClient } = await import('@/lib/api/server');
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: {} as never,
        userId: 'user-1',
      });

      const request = new NextRequest('http://localhost/api/settings/sessions', {
        method: 'DELETE',
      });
      const response = await DELETE(request);
      expect(response.status).toBe(400);
    });
  });
});
