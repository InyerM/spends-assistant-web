import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), review: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/api/category-review-server', () => ({ requestCategoryReview: mocks.review }));
import { getUserClient } from '@/lib/api/server';
import { POST } from '@/app/api/transactions/[id]/category-followup/explain/route';
const source = '10000000-0000-4000-8000-000000000001';
const target = '10000000-0000-4000-8000-000000000002';
const context = { params: Promise.resolve({ id: source }) };
const request = (body: unknown) =>
  new Request('https://my.anotto.app', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'token',
    supabase: { rpc: mocks.rpc } as never,
  });
  mocks.rpc.mockResolvedValue({
    error: null,
    data: {
      category_id: 'category',
      source: { id: source, type: 'expense', description: 'Source', notes: 'Source note' },
      rows: [{ id: target, description: 'Target', notes: 'Target note' }],
      evidence: [],
    },
  });
  mocks.review.mockResolvedValue({
    category_id: 'category',
    description: 'Suggested',
    notes: 'Preserved',
  });
});
it.each([undefined, target])(
  'forwards the authoritative reviewed movement identity %s and preserves editable wording',
  async (target_id) => {
    const response = await POST(
      request({
        locale: 'es',
        ...(target_id ? { target_id } : {}),
        description: 'Edited description',
        notes: 'Edited notes',
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.review).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        transaction_id: target_id ?? source,
        description: 'Edited description',
        notes: 'Edited notes',
      }),
    );
  },
);
it('rejects a target outside the owner-scoped contact result', async () => {
  const response = await POST(
    request({ locale: 'es', target_id: '10000000-0000-4000-8000-000000000099' }),
    context,
  );
  expect(response.status).toBe(404);
  expect(mocks.review).not.toHaveBeenCalled();
});
