import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiKeyKeys, fetchApiKeys } from '@/lib/api/queries/api-key.queries';

describe('apiKeyKeys', () => {
  it('all returns base key', () => {
    expect(apiKeyKeys.all).toEqual(['api-keys']);
  });

  it('lists extends all', () => {
    expect(apiKeyKeys.lists()).toEqual(['api-keys', 'list']);
  });

  it('list extends lists', () => {
    expect(apiKeyKeys.list()).toEqual(['api-keys', 'list']);
  });
});

describe('fetchApiKeys', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches api keys list', async () => {
    const keys = [
      {
        id: 'key-1',
        name: 'Test Key',
        is_active: true,
        last_used_at: null,
        created_at: '2024-01-01',
      },
      {
        id: 'key-2',
        name: 'Other Key',
        is_active: true,
        last_used_at: null,
        created_at: '2024-01-02',
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(keys), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await fetchApiKeys();
    expect(result).toEqual(keys);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );

    await expect(fetchApiKeys()).rejects.toThrow('Failed to fetch API keys');
  });
});
