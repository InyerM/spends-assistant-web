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

  it('keeps mandatory terms acceptance in the delegated Bearer handler', async () => {
    bearerGetUser.mockResolvedValue({
      data: { user: { id: 'mobile-owner', app_metadata: { anotto_terms_required: true } } },
      error: null,
    });
    await expect(
      getUserClient(
        new Request('https://anotto.app/api/financial-chat/history', {
          headers: { Authorization: 'Bearer mobile-access-token' },
        }),
      ),
    ).rejects.toThrow('Terms acceptance required');
    expect(cookieFactory).not.toHaveBeenCalled();
  });

  it('rejects a new Bearer owner without the required eligibility declaration', async () => {
    bearerGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'mobile-owner',
          created_at: '2026-10-21T00:00:00Z',
          user_metadata: {},
          app_metadata: {},
        },
      },
      error: null,
    });
    await expect(
      getUserClient(
        new Request('https://anotto.app/api/contacts', {
          headers: { Authorization: 'Bearer mobile-access-token' },
        }),
      ),
    ).rejects.toThrow('Eligibility confirmation required');
    expect(cookieFactory).not.toHaveBeenCalled();
  });

  it('allows an eligible Bearer owner and keeps account deletion available before declarations', async () => {
    bearerGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'mobile-owner',
          created_at: '2026-10-21T00:00:00Z',
          user_metadata: {
            anotto_eligibility: { adult: true, country: 'CO', version: '2026-10-06' },
          },
          app_metadata: {},
        },
      },
      error: null,
    });
    expect(
      (
        await getUserClient(
          new Request('https://anotto.app/api/contacts', {
            headers: { Authorization: 'Bearer mobile-access-token' },
          }),
        )
      ).userId,
    ).toBe('mobile-owner');
    bearerGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'mobile-owner',
          created_at: '2026-10-21T00:00:00Z',
          user_metadata: {},
          app_metadata: { anotto_terms_required: true },
        },
      },
      error: null,
    });
    expect(
      (
        await getUserClient(
          new Request('https://anotto.app/api/settings/account/delete', {
            method: 'POST',
            headers: { Authorization: 'Bearer mobile-access-token' },
          }),
        )
      ).userId,
    ).toBe('mobile-owner');
  });

  it('keeps the existing cookie session when no Authorization header is sent', async () => {
    const result = await getUserClient(new Request('https://anotto.app/api/documents'));

    expect(result.userId).toBe('cookie-owner');
    expect(cookieFactory).toHaveBeenCalledOnce();
    expect(cookieGetUser).toHaveBeenCalledWith();
    expect(bearerFactory).not.toHaveBeenCalled();
  });
  it.each([undefined, 'null', 'https://sibling.anotto.app', 'https://evil.test'])(
    'rejects cookie mutations from %s before client access',
    async (origin) => {
      const headers = new Headers();
      if (origin !== undefined) headers.set('Origin', origin);
      await expect(
        getUserClient(new Request('https://anotto.app/api/documents', { method: 'POST', headers })),
      ).rejects.toMatchObject({ status: 403 });
      expect(cookieFactory).not.toHaveBeenCalled();
      expect(bearerFactory).not.toHaveBeenCalled();
    },
  );
  it('accepts same-origin cookie mutations and verified allowlisted bearer mutations without Origin', async () => {
    expect(
      (
        await getUserClient(
          new Request('https://anotto.app/api/documents', {
            method: 'POST',
            headers: { Origin: 'https://anotto.app' },
          }),
        )
      ).userId,
    ).toBe('cookie-owner');
    expect(
      (
        await getUserClient(
          new Request('https://anotto.app/api/documents', {
            method: 'POST',
            headers: { Authorization: 'Bearer mobile-access-token' },
          }),
        )
      ).userId,
    ).toBe('mobile-owner');
  });
  it('rejects an unallowlisted bearer method even when browser cookies are available', async () => {
    await expect(
      getUserClient(
        new Request('https://anotto.app/api/automation-rules', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mobile-access-token',
            Cookie: 'synthetic-session',
            Origin: 'https://anotto.app',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(AuthError);
    expect(cookieFactory).not.toHaveBeenCalled();
    expect(bearerFactory).not.toHaveBeenCalled();
  });
  it('rejects invalid bearer mutation credentials without using a valid cookie session', async () => {
    bearerGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    await expect(
      getUserClient(
        new Request('https://anotto.app/api/documents', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer expired-token',
            Cookie: 'synthetic-session',
            Origin: 'https://anotto.app',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(AuthError);
    expect(cookieFactory).not.toHaveBeenCalled();
  });
});
