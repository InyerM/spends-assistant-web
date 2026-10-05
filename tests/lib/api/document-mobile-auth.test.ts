import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, getUserClient } from '@/lib/api/server';

const { cookieFactory, bearerFactory, cookieGetUser, bearerGetUser } = vi.hoisted(() => ({
  cookieFactory: vi.fn(),
  bearerFactory: vi.fn(),
  cookieGetUser: vi.fn(),
  bearerGetUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: cookieFactory,
  createAdminClient: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: bearerFactory }));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  },
}));

describe('document API user authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieGetUser.mockResolvedValue({ data: { user: { id: 'cookie-owner' } }, error: null });
    bearerGetUser.mockResolvedValue({ data: { user: { id: 'mobile-owner' } }, error: null });
    cookieFactory.mockResolvedValue({ auth: { getUser: cookieGetUser } });
    bearerFactory.mockReturnValue({ auth: { getUser: bearerGetUser } });
  });

  it('uses a verified Bearer session with the public anon key and user RLS', async () => {
    const request = new Request('https://anotto.app/api/documents', {
      headers: { Authorization: 'Bearer mobile-access-token' },
    });

    const result = await getUserClient(request);

    expect(result.userId).toBe('mobile-owner');
    expect(bearerGetUser).toHaveBeenCalledWith('mobile-access-token');
    expect(bearerFactory).toHaveBeenCalledWith(
      'https://supabase.example.test',
      'public-anon-key',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer mobile-access-token' } },
      }),
    );
    expect(cookieFactory).not.toHaveBeenCalled();
  });

  it('rejects invalid Bearer sessions without falling back to browser cookies', async () => {
    bearerGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    const request = new Request('https://anotto.app/api/documents', {
      headers: { Authorization: 'Bearer expired-token' },
    });

    await expect(getUserClient(request)).rejects.toBeInstanceOf(AuthError);
    expect(cookieFactory).not.toHaveBeenCalled();
  });

  it('rejects malformed authorization without falling back to browser cookies', async () => {
    const request = new Request('https://anotto.app/api/documents', {
      headers: { Authorization: 'Basic opaque' },
    });

    await expect(getUserClient(request)).rejects.toBeInstanceOf(AuthError);
    expect(cookieFactory).not.toHaveBeenCalled();
    expect(bearerFactory).not.toHaveBeenCalled();
  });

  it('keeps the existing cookie session when no Authorization header is sent', async () => {
    const result = await getUserClient(new Request('https://anotto.app/api/documents'));

    expect(result.userId).toBe('cookie-owner');
    expect(cookieFactory).toHaveBeenCalledOnce();
    expect(cookieGetUser).toHaveBeenCalledWith();
    expect(bearerFactory).not.toHaveBeenCalled();
  });
});
