import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/api/category-review-server', () => ({ requestCategoryReview: vi.fn() }));
import { getUserClient } from '@/lib/api/server';
import { requestCategoryReview } from '@/lib/api/category-review-server';
import { POST as explain } from '@/app/api/transactions/[id]/category-followup/explain/route';
import { POST as save } from '@/app/api/transactions/[id]/category-followup/review/route';
const id = '10000000-0000-4000-8000-000000000001',
  target = '10000000-0000-4000-8000-000000000002',
  category = '20000000-0000-4000-8000-000000000001';
const rpc = vi.fn(),
  ctx = { params: Promise.resolve({ id }) };
const request = (body: unknown) =>
  new Request('https://my.anotto.app', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    accessToken: 'token',
    supabase: { rpc } as never,
  });
  rpc.mockResolvedValue({
    data: {
      source: { id, type: 'expense', description: 'Lunch', notes: 'Confirmed lunch' },
      category_id: category,
      evidence: [{ id, description: 'Lunch', notes: 'Meal', category_name: 'Food' }],
      rows: [{ id: target, description: 'Older', notes: null }],
    },
    error: null,
  });
  vi.mocked(requestCategoryReview).mockResolvedValue({
    category_id: category,
    description: 'Lunch',
    notes: 'Meal',
    explanation: 'Earlier notes mention lunch.',
    kind: 'expense',
    evidence_ids: [id],
  });
});
it('only sends notes from the owner-scoped contact context and refuses an unrelated target', async () => {
  expect((await explain(request({ locale: 'es', target_id: target }), ctx)).status).toBe(200);
  expect(requestCategoryReview).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({
      history: [{ id, description: 'Lunch', notes: 'Meal', category: 'Food' }],
    }),
  );
  expect((await explain(request({ locale: 'es', target_id: category }), ctx)).status).toBe(404);
  expect(requestCategoryReview).toHaveBeenCalledTimes(1);
});
it('forwards each explicit category and text edit with expected values, rejecting money and evidence edits', async () => {
  const body = {
    source_category_id: category,
    targets: [
      {
        id: target,
        category_id: category,
        description: 'Reviewed',
        notes: 'Purpose',
        expected_category_id: null,
        expected_description: 'Older',
        expected_notes: null,
      },
    ],
  };
  expect((await save(request(body), ctx)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('apply_counterparty_review', {
    p_source: id,
    p_source_category: category,
    p_targets: body.targets,
  });
  expect(
    (
      await save(
        request({ ...body, targets: [{ ...body.targets[0], raw_text: 'Changed bank evidence' }] }),
        ctx,
      )
    ).status,
  ).toBe(400);
});
