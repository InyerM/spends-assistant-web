import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  categoryKeys,
  fetchCategories,
  buildCategoryTree,
} from '@/lib/api/queries/category.queries';

describe('categoryKeys', () => {
  it('all returns base key', () => {
    expect(categoryKeys.all).toEqual(['categories']);
  });

  it('lists extends all', () => {
    expect(categoryKeys.lists()).toEqual(['categories', 'list']);
  });

  it('list extends lists', () => {
    expect(categoryKeys.list()).toEqual(['categories', 'list']);
  });

  it('tree extends all', () => {
    expect(categoryKeys.tree()).toEqual(['categories', 'tree']);
  });
});

describe('fetchCategories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches categories list', async () => {
    const categories = [{ id: 'cat-1', name: 'Food' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(categories), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await fetchCategories();
    expect(result).toEqual(categories);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );

    await expect(fetchCategories()).rejects.toThrow('Failed to fetch categories');
  });
});

describe('buildCategoryTree', () => {
  it('builds tree from flat categories', () => {
    const categories = [
      { id: 'cat-1', name: 'Food', parent_id: null },
      { id: 'cat-2', name: 'Transport', parent_id: null },
      { id: 'cat-3', name: 'Fast Food', parent_id: 'cat-1' },
      { id: 'cat-4', name: 'Groceries', parent_id: 'cat-1' },
    ] as never[];

    const tree = buildCategoryTree(categories);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[1].children).toHaveLength(0);
  });

  it('handles empty array', () => {
    const tree = buildCategoryTree([]);
    expect(tree).toHaveLength(0);
  });

  it('handles no children', () => {
    const categories = [{ id: 'cat-1', name: 'Food', parent_id: null }] as never[];

    const tree = buildCategoryTree(categories);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(0);
  });
});
