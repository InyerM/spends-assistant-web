import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DuplicateError,
  createTransaction,
  forceCreateTransaction,
  replaceTransaction,
  updateTransaction,
  deleteTransaction,
  bulkUpdateTransactions,
  resolveDuplicate,
} from '@/lib/api/mutations/transaction.mutations';
import { createMockTransaction } from '@/tests/__test-helpers__/factories';
import type { CreateTransactionInput } from '@/types';

const INPUT: CreateTransactionInput = {
  date: '2024-01-15',
  time: '14:30',
  amount: 50000,
  description: 'Test',
  account_id: 'acc-1',
  type: 'expense',
  source: 'api',
};

describe('DuplicateError', () => {
  it('creates error with match and input', () => {
    const match = createMockTransaction();
    const error = new DuplicateError(match, INPUT);
    expect(error.message).toBe('Duplicate transaction detected');
    expect(error.match).toEqual(match);
    expect(error.input).toEqual(INPUT);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('createTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns transaction on success', async () => {
    const tx = createMockTransaction();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(tx), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await createTransaction(INPUT);
    expect(result).toEqual(tx);
  });

  it('throws DuplicateError on 409', async () => {
    const match = createMockTransaction();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ duplicate: true, match }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(createTransaction(INPUT)).rejects.toThrow(DuplicateError);
  });

  it('throws generic error on other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(createTransaction(INPUT)).rejects.toThrow('Server error');
  });
});

describe('forceCreateTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends request with force=true', async () => {
    const tx = createMockTransaction();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(tx), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await forceCreateTransaction(INPUT);
    expect(result).toEqual(tx);
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('force=true');
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(forceCreateTransaction(INPUT)).rejects.toThrow('Failed');
  });
});

describe('replaceTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends request with replace param', async () => {
    const tx = createMockTransaction();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(tx), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await replaceTransaction(INPUT, 'old-tx-id');
    expect(result).toEqual(tx);
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('replace=old-tx-id');
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Replace failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(replaceTransaction(INPUT, 'old-tx-id')).rejects.toThrow('Replace failed');
  });
});

describe('updateTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends PATCH and returns updated transaction', async () => {
    const tx = createMockTransaction();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(tx), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await updateTransaction({ id: 'tx-1', description: 'Updated' } as never);
    expect(result).toEqual(tx);
  });

  it('throws on error', async () => {
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

    await expect(updateTransaction({ id: 'tx-1' } as never)).rejects.toThrow('Update failed');
  });
});

describe('deleteTransaction', () => {
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

    await deleteTransaction('tx-1');
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/transactions/tx-1');
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Delete failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(deleteTransaction('tx-1')).rejects.toThrow('Delete failed');
  });
});

describe('bulkUpdateTransactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends PATCH to bulk endpoint', async () => {
    const txs = [createMockTransaction()];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(txs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await bulkUpdateTransactions({
      ids: ['tx-1'],
      updates: { category_id: 'cat-1' },
    });
    expect(result).toEqual(txs);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Bulk failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(bulkUpdateTransactions({ ids: ['tx-1'], updates: {} })).rejects.toThrow(
      'Bulk failed',
    );
  });
});

describe('resolveDuplicate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps duplicate by confirming', async () => {
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

    await resolveDuplicate('tx-1', 'keep');
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('PATCH');
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.duplicate_status).toBe('confirmed');
  });

  it('deletes duplicate', async () => {
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

    await resolveDuplicate('tx-1', 'delete');
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[1].method).toBe('DELETE');
  });

  it('throws on keep error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'fail' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(resolveDuplicate('tx-1', 'keep')).rejects.toThrow();
  });
});
