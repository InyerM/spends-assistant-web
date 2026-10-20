import { expect, it, vi } from 'vitest';
const { owned, review, rpc } = vi.hoisted(() => ({
  owned: vi.fn(),
  review: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient: () =>
    Promise.resolve({
      userId: 'owner',
      accessToken: 'token',
      supabase: {
        from: (table: string) => {
          const query = {
            select: () => query,
            eq: () => query,
            is: () => query,
            single: () =>
              table === 'transactions' ? owned() : Promise.resolve({ data: { type: 'checking' } }),
          };
          return query;
        },
        rpc,
      },
    }),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/api/category-review-server', () => ({ requestCategoryReview: review }));
import { POST } from '@/app/api/transactions/[id]/analyze/route';
it('reviews edited metadata from the owned transaction and original evidence without posting financial changes', async () => {
  owned.mockResolvedValueOnce({
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      type: 'expense',
      account_id: 'bank',
      description: 'Original',
      notes: null,
      category_id: 'food',
      raw_text: 'Bank evidence',
    },
    error: null,
  });
  review.mockResolvedValueOnce({
    category_id: 'food',
    description: 'Lunch',
    notes: 'Lunch note',
    explanation: 'Message evidence',
    kind: 'expense',
    evidence_ids: [],
  });
  const request = new Request('http://localhost/api/transactions/a/analyze', {
    method: 'POST',
    body: JSON.stringify({ locale: 'es', description: 'Edited lunch', notes: 'Lunch note' }),
  });
  const second = request.clone();
  const response = await POST(request, {
    params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }),
  });
  expect(response.status).toBe(200);
  expect(review).toHaveBeenCalledWith(
    'token',
    expect.objectContaining({
      type: 'expense',
      description: 'Edited lunch',
      excerpt: 'Bank evidence',
    }),
  );
  owned.mockResolvedValueOnce({ data: null, error: { message: 'Missing' } });
  expect(
    (
      await POST(second, {
        params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }),
      })
    ).status,
  ).toBe(404);
});
