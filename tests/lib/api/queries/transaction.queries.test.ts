import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  transactionKeys,
  fetchTransactions,
  fetchTransaction,
} from '@/lib/api/queries/transaction.queries';

describe('transactionKeys', () => {
  it('all returns base key', () => {
    expect(transactionKeys.all).toEqual(['transactions']);
  });

  it('lists extends all', () => {
    expect(transactionKeys.lists()).toEqual(['transactions', 'list']);
  });

  it('list includes filters', () => {
    const filters = { type: 'expense' as const };
    expect(transactionKeys.list(filters)).toEqual(['transactions', 'list', filters]);
  });

  it('details extends all', () => {
    expect(transactionKeys.details()).toEqual(['transactions', 'detail']);
  });

  it('detail includes id', () => {
    expect(transactionKeys.detail('tx-1')).toEqual(['transactions', 'detail', 'tx-1']);
  });

  it('infinite includes filters', () => {
    const filters = { date_from: '2024-01-01' };
    expect(transactionKeys.infinite(filters)).toEqual(['transactions', 'infinite', filters]);
  });
});

describe('fetchTransactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches with no filters', async () => {
    const result = { data: [], count: 0 };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const data = await fetchTransactions({});
    expect(data).toEqual(result);
  });

  it('builds URL params from filters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [], count: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await fetchTransactions({
      page: 2,
      limit: 10,
      types: ['expense', 'income'],
      account_ids: ['acc-1', 'acc-2'],
      category_ids: ['cat-1'],
      source: 'api',
      date_from: '2024-01-01',
      date_to: '2024-01-31',
      search: 'food',
      sort_by: 'amount',
      sort_order: 'desc',
      duplicate_status: 'pending_review',
    });

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = fetchCall[0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(url).toContain('types=expense%2Cincome');
    expect(url).toContain('account_ids=acc-1%2Cacc-2');
    expect(url).toContain('category_ids=cat-1');
    expect(url).toContain('source=api');
    expect(url).toContain('date_from=2024-01-01');
    expect(url).toContain('date_to=2024-01-31');
    expect(url).toContain('search=food');
    expect(url).toContain('sort_by=amount');
    expect(url).toContain('sort_order=desc');
    expect(url).toContain('duplicate_status=pending');
  });

  it('uses type filter when types not provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [], count: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await fetchTransactions({ type: 'expense' });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('type=expense');
  });

  it('uses account_id filter when account_ids not provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [], count: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await fetchTransactions({ account_id: 'acc-1' });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('account_id=acc-1');
  });

  it('uses category_id filter when category_ids not provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [], count: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await fetchTransactions({ category_id: 'cat-1' });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('category_id=cat-1');
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );

    await expect(fetchTransactions({})).rejects.toThrow('Failed to fetch transactions');
  });
});

describe('fetchTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches single transaction', async () => {
    const tx = { id: 'tx-1', description: 'Test' };
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

    const result = await fetchTransaction('tx-1');
    expect(result).toEqual(tx);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );

    await expect(fetchTransaction('tx-999')).rejects.toThrow('Failed to fetch transaction');
  });
});
