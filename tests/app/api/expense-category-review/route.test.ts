import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  range: vi.fn(),
  ilike: vi.fn(),
  categories: vi.fn(),
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient: async () => ({
    userId: 'owner',
    accessToken: 'token',
    supabase: {
      rpc: mocks.rpc,
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: (...args: unknown[]) => {
            mocks.eq(table, ...args);
            return query;
          },
          in: () => mocks.categories(),
          is: () => query,
          order: () => query,
          or: (...args: unknown[]) => {
            mocks.or(...args);
            return query;
          },
          ilike: (...args: unknown[]) => {
            mocks.ilike(...args);
            return query;
          },
          range: mocks.range,
        };
        return query;
      },
    },
  }),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { GET } from '@/app/api/transactions/category-review/route';
import { POST } from '@/app/api/transactions/[id]/category-review/route';
const id = '00000000-0000-4000-8000-000000000001';
const category = '00000000-0000-4000-8000-000000000002';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.categories.mockResolvedValue({ data: [{ id: category }], error: null });
  mocks.range.mockResolvedValue({ data: [{ id, description: 'Spotify' }], count: 1, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});
it('lists uncategorized expenses across all dates including null categories without requiring a contact', async () => {
  const response = await GET(new Request('https://app.test/api/transactions/category-review'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    data: [{ description: 'Spotify' }],
    count: 1,
    page: 1,
  });
  expect(mocks.eq).toHaveBeenCalledWith('transactions', 'user_id', 'owner');
  expect(mocks.eq).toHaveBeenCalledWith('transactions', 'type', 'expense');
  expect(mocks.or).toHaveBeenCalledWith(`category_id.is.null,category_id.in.(${category})`);
  expect(mocks.range).toHaveBeenCalledWith(0, 9);
});
it('allows reviewing existing categories with bounded search and pagination', async () => {
  const response = await GET(
    new Request(
      'https://app.test/api/transactions/category-review?scope=all&page=2&search=restaurant',
    ),
  );
  expect(response.status).toBe(200);
  expect(mocks.or).not.toHaveBeenCalled();
  expect(mocks.ilike).toHaveBeenCalledWith('description', '%restaurant%');
  expect(mocks.range).toHaveBeenCalledWith(10, 19);
  expect(
    (await GET(new Request('https://app.test/api/transactions/category-review?page=0'))).status,
  ).toBe(400);
});
it('saves only an explicitly selected category through owner-scoped stale-checked SQL', async () => {
  const body = {
    category_id: category,
    expected: { category_id: null, description: 'Spotify', notes: null, account_id: id },
  };
  const send = (payload: unknown) =>
    POST(
      new Request('https://app.test/api/transactions/' + id + '/category-review', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id }) },
    );
  expect((await send(body)).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith('review_expense_category', {
    p_transaction: id,
    p_category: category,
    p_expected: body.expected,
  });
  expect((await send({ ...body, amount: 1 })).status).toBe(400);
  mocks.rpc.mockResolvedValueOnce({ error: { code: '23514' } });
  expect((await send(body)).status).toBe(409);
});
it('saves selected wording and notes without requiring a category and rejects financial fields', async () => {
  const expected = {
    category_id: category,
    description: 'Original',
    notes: 'Old note',
    account_id: id,
  };
  const send = (changes: unknown) =>
    POST(
      new Request('https://app.test/api/transactions/' + id + '/category-review', {
        method: 'POST',
        body: JSON.stringify({ changes, expected }),
      }),
      { params: Promise.resolve({ id }) },
    );
  expect((await send({ description: 'Clear title', notes: null })).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith('review_expense_metadata', {
    p_transaction: id,
    p_changes: { description: 'Clear title', notes: null },
    p_expected: expected,
  });
  expect((await send({ amount: 1, description: 'Unsafe' })).status).toBe(400);
  expect((await send({})).status).toBe(400);
  expect((await send({ description: '' })).status).toBe(400);
});
