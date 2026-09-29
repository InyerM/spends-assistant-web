import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAdminClient, getUserClient, hashApiKey, eq, maybeSingle } = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  getUserClient: vi.fn(),
  hashApiKey: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/api/server', () => ({
  getAdminClient,
  getUserClient,
  AuthError: class AuthError extends Error {
    constructor() {
      super('Unauthorized');
    }
  },
}));
vi.mock('@/lib/utils/api-key', () => ({ hashApiKey }));

import { getShortcutPostClient } from '@/lib/shortcut-inbox/auth';

describe('Shortcut inbox API key authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashApiKey.mockResolvedValue('hashed-key');
    eq.mockReturnValue({ eq, maybeSingle });
    getAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq }) }) });
    maybeSingle.mockResolvedValue({ data: { user_id: 'owner-a' }, error: null });
  });

  it('derives owner from an active hashed key, never the request body', async () => {
    const request = new Request('https://example.test/api/shortcut-inbox', {
      headers: { Authorization: 'Bearer sk_syntheticsecret' },
    });
    const result = await getShortcutPostClient(request);
    expect(hashApiKey).toHaveBeenCalledWith('sk_syntheticsecret');
    expect(eq).toHaveBeenCalledWith('key_hash', 'hashed-key');
    expect(eq).toHaveBeenCalledWith('is_active', true);
    expect(result.userId).toBe('owner-a');
    expect(result.supabase).toBe(getAdminClient.mock.results[0].value);
    expect(getUserClient).not.toHaveBeenCalled();
  });

  it('rejects an inactive or unknown API key', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const request = new Request('https://example.test/api/shortcut-inbox', {
      headers: { Authorization: 'Bearer sk_unknown' },
    });
    await expect(getShortcutPostClient(request)).rejects.toThrow('Unauthorized');
    expect(getUserClient).not.toHaveBeenCalled();
  });

  it('does not fall back to a cookie when an invalid Authorization header is supplied', async () => {
    const request = new Request('https://example.test/api/shortcut-inbox', {
      headers: { Authorization: 'Bearer invalid' },
    });
    await expect(getShortcutPostClient(request)).rejects.toThrow('Unauthorized');
    expect(getUserClient).not.toHaveBeenCalled();
  });
});
