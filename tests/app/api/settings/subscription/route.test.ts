import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/settings/subscription/route';
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

describe('Settings Subscription API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/settings/subscription', () => {
    it('returns subscription data', async () => {
      const subscription = {
        id: 'sub-1',
        user_id: 'user-1',
        plan: 'free',
        status: 'active',
        current_period_start: null,
        current_period_end: null,
      };

      const { getUserClient } = await import('@/lib/api/server');
      const mock = createMockSupabase(subscription);
      vi.mocked(getUserClient).mockResolvedValue({
        supabase: mock as never,
        userId: 'user-1',
      });

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.plan).toBe('free');
      expect(body.status).toBe('active');
    });

    it('returns free defaults when no subscription found', async () => {
      const { getUserClient } = await import('@/lib/api/server');
      const mock = createMockSupabase(null, { message: 'Row not found' });
      // Override single to return PGRST116 error
      mock._chain.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      });

      vi.mocked(getUserClient).mockResolvedValue({
        supabase: mock as never,
        userId: 'user-1',
      });

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.plan).toBe('free');
      expect(body.status).toBe('active');
    });
  });
});
