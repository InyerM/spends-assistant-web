import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { getUserClient } from '@/lib/api/server';
import { GET as activity } from '@/app/api/accounts/[id]/activity/route';
import { GET as suggestions } from '@/app/api/transactions/category-suggestions/route';
const id = '10000000-0000-4000-8000-000000000001',
  rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({ userId: 'owner', supabase: { rpc } as never });
  rpc.mockResolvedValue({ data: [], error: null });
});
it('reads a single owner ledger and rejects invalid identifiers before SQL', async () => {
  expect(
    (await activity(new Request('https://my.anotto.app'), { params: Promise.resolve({ id }) }))
      .status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('account_activity', { p_account: id });
  expect(
    (
      await activity(new Request('https://my.anotto.app'), {
        params: Promise.resolve({ id: 'bad' }),
      })
    ).status,
  ).toBe(400);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('scopes the permanent review to an optional contact without accepting an owner override', async () => {
  const response = await suggestions(
    new Request(
      'https://my.anotto.app/api/transactions/category-suggestions?contact_id=' +
        id +
        '&user_id=foreign',
    ),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(rpc).toHaveBeenCalledWith('list_category_suggestions', { p_contact: id });
  expect(
    (
      await suggestions(
        new Request('https://my.anotto.app/api/transactions/category-suggestions?contact_id=bad'),
      )
    ).status,
  ).toBe(400);
  expect(rpc).toHaveBeenCalledTimes(1);
});
