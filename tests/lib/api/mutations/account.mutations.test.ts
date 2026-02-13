import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAccount, updateAccount, deleteAccount } from '@/lib/api/mutations/account.mutations';

describe('createAccount', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST and returns account', async () => {
    const account = { id: 'acc-1', name: 'Test' };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(account), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await createAccount({ name: 'Test', type: 'checking' } as never);
    expect(result).toEqual(account);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/accounts');
    expect(fetchCall[1].method).toBe('POST');
  });

  it('throws on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Duplicate name' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(createAccount({ name: 'Test', type: 'checking' } as never)).rejects.toThrow(
      'Duplicate name',
    );
  });
});

describe('updateAccount', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends PATCH and returns updated account', async () => {
    const account = { id: 'acc-1', name: 'Updated' };
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

    const result = await updateAccount({ id: 'acc-1', name: 'Updated' } as never);
    expect(result).toEqual(account);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/accounts/acc-1');
    expect(fetchCall[1].method).toBe('PATCH');
  });

  it('throws on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Update failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(updateAccount({ id: 'acc-1', name: '' } as never)).rejects.toThrow(
      'Update failed',
    );
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends DELETE request', async () => {
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

    await deleteAccount('acc-1');
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/accounts/acc-1');
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

    await expect(deleteAccount('acc-1')).rejects.toThrow('Cannot delete');
  });
});
