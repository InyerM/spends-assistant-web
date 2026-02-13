import { describe, it, expect, vi, beforeEach } from 'vitest';
import { accountKeys, fetchAccounts, fetchAccount } from '@/lib/api/queries/account.queries';

describe('accountKeys', () => {
  it('all returns base key', () => {
    expect(accountKeys.all).toEqual(['accounts']);
  });

  it('lists extends all', () => {
    expect(accountKeys.lists()).toEqual(['accounts', 'list']);
  });

  it('list extends lists', () => {
    expect(accountKeys.list()).toEqual(['accounts', 'list']);
  });

  it('details extends all', () => {
    expect(accountKeys.details()).toEqual(['accounts', 'detail']);
  });

  it('detail includes id', () => {
    expect(accountKeys.detail('acc-1')).toEqual(['accounts', 'detail', 'acc-1']);
  });
});

describe('fetchAccounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches accounts list', async () => {
    const accounts = [{ id: 'acc-1' }, { id: 'acc-2' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(accounts), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await fetchAccounts();
    expect(result).toEqual(accounts);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );

    await expect(fetchAccounts()).rejects.toThrow('Failed to fetch accounts');
  });
});

describe('fetchAccount', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches single account', async () => {
    const account = { id: 'acc-1', name: 'Checking' };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(account), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await fetchAccount('acc-1');
    expect(result).toEqual(account);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );

    await expect(fetchAccount('acc-999')).rejects.toThrow('Failed to fetch account');
  });
});
