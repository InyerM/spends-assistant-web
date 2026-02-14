import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/settings/sessions/track/route';
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

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'user-agent')
        return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
      if (name === 'x-forwarded-for') return '192.168.1.1';
      return null;
    }),
  }),
}));

vi.mock('ua-parser-js', () => {
  class MockUAParser {
    getBrowser(): { name: string; version: string } {
      return { name: 'Chrome', version: '120' };
    }
    getOS(): { name: string; version: string } {
      return { name: 'macOS', version: '14' };
    }
    getDevice(): { type: undefined; model: undefined; vendor: undefined } {
      return { type: undefined, model: undefined, vendor: undefined };
    }
  }
  return { UAParser: MockUAParser };
});

describe('POST /api/settings/sessions/track', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a new session when none exists', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mock = createMockSupabase([]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mock as never,
      userId: 'user-1',
    });

    const response = await POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('updates existing session when match found', async () => {
    const { getUserClient } = await import('@/lib/api/server');
    const mock = createMockSupabase([{ id: 'sess-1' }]);
    vi.mocked(getUserClient).mockResolvedValue({
      supabase: mock as never,
      userId: 'user-1',
    });

    const response = await POST();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
