import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  fetchCategoryWithCounts,
} from '@/lib/api/mutations/category.mutations';

describe('createCategory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST and returns category', async () => {
    const cat = { id: 'cat-1', name: 'Food' };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(cat), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await createCategory({ name: 'Food' } as never);
    expect(result).toEqual(cat);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Insert failed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(createCategory({ name: '' } as never)).rejects.toThrow('Insert failed');
  });
});

describe('updateCategory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends PATCH and returns updated category', async () => {
    const cat = { id: 'cat-1', name: 'Updated' };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(cat), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await updateCategory({ id: 'cat-1', name: 'Updated' } as never);
    expect(result).toEqual(cat);
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

    await expect(updateCategory({ id: 'cat-1' } as never)).rejects.toThrow('Update failed');
  });
});

describe('deleteCategory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends DELETE and returns result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true, unlinked_transactions: 5 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await deleteCategory('cat-1');
    expect(result.success).toBe(true);
    expect(result.unlinked_transactions).toBe(5);
  });

  it('throws on error', async () => {
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

    await expect(deleteCategory('cat-1')).rejects.toThrow('Cannot delete');
  });
});

describe('fetchCategoryWithCounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches with include_counts param', async () => {
    const cat = { id: 'cat-1', name: 'Food', transaction_count: 10, children_count: 2 };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(cat), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await fetchCategoryWithCounts('cat-1');
    expect(result.transaction_count).toBe(10);
    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain('include_counts=true');
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );

    await expect(fetchCategoryWithCounts('cat-999')).rejects.toThrow();
  });
});
