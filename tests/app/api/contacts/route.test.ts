import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { getUserClient } from '@/lib/api/server';
import { GET, POST } from '@/app/api/contacts/route';
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'test',
    supabase: { rpc } as never,
  });
});
it('bounds scan pages and returns the owner-scoped catalog', async () => {
  rpc.mockResolvedValue({ data: { items: [], count: 0 }, error: null });
  expect((await GET(new Request('https://my.anotto.app/api/contacts?q=demo&page=1'))).status).toBe(
    200,
  );
  expect(rpc).toHaveBeenCalledWith('list_counterparties', {
    p_query: 'demo',
    p_offset: 0,
    p_limit: 50,
  });
  expect(
    (
      await POST(
        new Request('https://my.anotto.app/api/contacts', {
          method: 'POST',
          body: '{"after":"bad"}',
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (await POST(new Request('https://my.anotto.app/api/contacts', { method: 'POST', body: '{}' })))
      .status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('scan_counterparty_catalog', { p_after: null, p_limit: 200 });
});
it('sorts by transaction count in SQL before pagination and rejects unknown sort values', async () => {
  rpc.mockResolvedValue({ data: { items: [], count: 0 }, error: null });
  expect(
    (await GET(new Request('https://my.anotto.app/api/contacts?sort=most_transactions&page=2')))
      .status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('list_counterparties_sorted', {
    p_query: '',
    p_offset: 50,
    p_limit: 50,
    p_sort: 'most_transactions',
  });
  rpc.mockClear();
  expect((await GET(new Request('https://my.anotto.app/api/contacts?sort=invalid'))).status).toBe(
    400,
  );
  expect(rpc).not.toHaveBeenCalled();
});

it('returns a global top five summary independently of directory pagination', async () => {
  rpc.mockResolvedValue({ data: { items: [], count: 100, scan: { total: 200 } }, error: null });
  const response = await GET(new Request('https://my.anotto.app/api/contacts?summary=1'));
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('list_counterparties_sorted', {
    p_query: '',
    p_offset: 0,
    p_limit: 5,
    p_sort: 'most_transactions',
  });
});
