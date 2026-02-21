import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApiKey, deleteApiKey } from '@/lib/api/mutations/api-key.mutations';

describe('createApiKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST and returns new key response', async () => {
    const response = {
      id: 'key-1',
      name: 'Test',
      key: 'sk_test_abc123',
      is_active: true,
      last_used_at: null,
      created_at: '2024-01-01',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await createApiKey('Test');
    expect(result).toEqual(response);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/api-keys');
    expect(fetchCall[1].method).toBe('POST');
  });

  it('uses "Default" name when empty string is provided', async () => {
    const response = {
      id: 'key-1',
      name: 'Default',
      key: 'sk_test_abc123',
      is_active: true,
      last_used_at: null,
      created_at: '2024-01-01',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(response), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await createApiKey('');

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body as string) as { name: string };
    expect(body.name).toBe('Default');
  });

  it('throws on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Rate limited' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(createApiKey('Test')).rejects.toThrow('Rate limited');
  });
});

describe('deleteApiKey', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends DELETE request with id in query params', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await deleteApiKey('key-1');
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/api-keys?id=key-1');
    expect(fetchCall[1].method).toBe('DELETE');
  });

  it('throws on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Cannot delete' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(deleteApiKey('key-1')).rejects.toThrow('Cannot delete');
  });
});
