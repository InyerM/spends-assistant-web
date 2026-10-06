import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon-key',
  },
}));

function request(path: string, method = 'GET', authorization?: string): NextRequest {
  return new NextRequest(`https://example.test${path}`, {
    method,
    headers: authorization ? { authorization } : undefined,
  });
}

describe('authentication proxy', () => {
  beforeEach(() => {
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it('lets the Shortcut POST handler authenticate an API key without a browser session', async () => {
    const response = await proxy(request('/api/shortcut-inbox', 'POST', 'Bearer sk_synthetic'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('still redirects unauthenticated Shortcut reads and unrelated writes', async () => {
    const inboxGet = await proxy(request('/api/shortcut-inbox'));
    const inboxPostWithoutKey = await proxy(request('/api/shortcut-inbox', 'POST'));
    const unrelatedPost = await proxy(request('/api/transactions', 'POST'));
    expect(inboxGet.status).toBe(307);
    expect(inboxPostWithoutKey.status).toBe(307);
    expect(unrelatedPost.status).toBe(307);
  });

  it('lets document routes verify mobile bearer tokens without a browser cookie', async () => {
    const list = await proxy(request('/api/documents', 'GET', 'Bearer mobile-jwt'));
    const upload = await proxy(request('/api/documents', 'POST', 'Bearer mobile-jwt'));
    const extract = await proxy(
      request('/api/documents/document-1/extract', 'POST', 'Bearer mobile-jwt'),
    );

    expect([list.status, upload.status, extract.status]).toEqual([200, 200, 200]);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('keeps document routes protected without a bearer token', async () => {
    const response = await proxy(request('/api/documents'));
    expect(response.status).toBe(307);
  });

  it('allows recovery requests before sign-in but protects the password form', async () => {
    const requestLink = await proxy(request('/forgot-password'));
    const callback = await proxy(request('/auth/recovery?code=synthetic'));
    const resetForm = await proxy(request('/reset-password'));

    expect(requestLink.status).toBe(200);
    expect(callback.status).toBe(200);
    expect(resetForm.status).toBe(307);
  });

  it('lets an already signed-in browser exchange a newer recovery code', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'synthetic-user' } } });

    const response = await proxy(request('/auth/recovery?code=synthetic'));

    expect(response.status).toBe(200);
  });

  it('allows the transaction creation route to verify a mobile bearer token', async () => {
    const response = await proxy(request('/api/transactions', 'POST', 'Bearer mobile-jwt'));
    expect(response.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([
    ['/api/api-keys', 'GET'],
    ['/api/api-keys', 'POST'],
    ['/api/api-keys', 'DELETE'],
    ['/api/settings/sessions', 'GET'],
    ['/api/settings/user-settings', 'GET'],
    ['/api/settings/user-settings', 'PATCH'],
    ['/api/settings/account/delete', 'POST'],
    ['/api/merchant-suggestions', 'POST'],
  ])('lets %s %s verify mobile bearer tokens in its route', async (path, method) => {
    const response = await proxy(request(path, method, 'Bearer mobile-jwt'));
    expect(response.status).toBe(200);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('keeps mobile security routes protected without a bearer token', async () => {
    for (const [path, method] of [
      ['/api/api-keys', 'GET'],
      ['/api/settings/user-settings', 'PATCH'],
      ['/api/settings/account/delete', 'POST'],
    ]) {
      expect((await proxy(request(path, method))).status).toBe(307);
    }
  });
});
