import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/auth/recovery/route';

const exchangeCodeForSession = vi.fn();
const createServerClient = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

describe('GET /auth/recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerClient.mockReturnValue({ auth: { exchangeCodeForSession } });
  });

  it('rejects a missing recovery code without reflecting upstream error text', async () => {
    const response = await GET(
      new NextRequest('https://panel.anotto.app/auth/recovery?error_description=private'),
    );

    expect(response.headers.get('location')).toBe(
      'https://panel.anotto.app/forgot-password?error=invalid-link',
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('exchanges a recovery code, scopes the session cookie, and opens the reset form', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'synthetic-token' }]);
      return { auth: { exchangeCodeForSession } };
    });

    const response = await GET(
      new NextRequest('https://panel.anotto.app/auth/recovery?code=synthetic-code'),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith('synthetic-code');
    expect(response.headers.get('location')).toBe('https://panel.anotto.app/reset-password');
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('synthetic-token');
  });

  it('rejects an expired recovery code', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('expired') });

    const response = await GET(
      new NextRequest('https://panel.anotto.app/auth/recovery?code=expired'),
    );

    expect(response.headers.get('location')).toBe(
      'https://panel.anotto.app/forgot-password?error=invalid-link',
    );
  });
});
