import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
import { getUserClient } from '@/lib/api/server';
import { GET, POST } from '@/app/api/transactions/[id]/category-followup/route';
const rpc = vi.fn(),
  id = '10000000-0000-4000-8000-000000000001',
  context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'token',
    supabase: { rpc } as never,
  });
});
it('reads bounded suggestions and forwards only explicit expected-category selections', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await GET(new Request('https://my.anotto.app'), context)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('counterparty_category_followup', { p_transaction: id });
  const body = { category_id: id, targets: [{ id, category_id: null }] };
  expect(
    (
      await POST(
        new Request('https://my.anotto.app', { method: 'POST', body: JSON.stringify(body) }),
        context,
      )
    ).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith('apply_counterparty_category_followup', {
    p_transaction: id,
    p_category: id,
    p_targets: body.targets,
  });
  expect(
    (
      await POST(
        new Request('https://my.anotto.app', {
          method: 'POST',
          body: JSON.stringify({ ...body, targets: [] }),
        }),
        context,
      )
    ).status,
  ).toBe(400);
});
