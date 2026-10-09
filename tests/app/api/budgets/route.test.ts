import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, POST, PATCH } from '@/app/api/budgets/route';
import { getUserClient } from '@/lib/api/server';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const categoryId = '11111111-1111-4111-8111-111111111111';
const budgetId = '22222222-2222-4222-8222-222222222222';

function request(method: string, body?: unknown, month?: string): NextRequest {
  return new NextRequest(`http://localhost/api/budgets${month ? `?month=${month}` : ''}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe('/api/budgets', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    rpc.mockResolvedValue({ data: [], error: null });
    vi.mocked(getUserClient).mockResolvedValue({
      userId: 'owner-1',
      supabase: { rpc } as never,
    });
  });

  it('loads only the requested first-of-month status with private caching', async () => {
    const response = await GET(request('GET', undefined, '2026-10-01'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(rpc).toHaveBeenCalledWith('get_monthly_budget_status', { p_month: '2026-10-01' });
    expect((await GET(request('GET', undefined, '2026-10-08'))).status).toBe(400);
  });

  it('validates a COP limit before calling the owner-scoped RPC', async () => {
    expect(
      (
        await POST(
          request('POST', { month: '2026-10-08', category_id: categoryId, limit_cop: 500 }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await POST(request('POST', { month: '2026-10-01', category_id: categoryId, limit_cop: 0 })))
        .status,
    ).toBe(400);
    expect(
      (await POST(request('POST', { month: '2026-10-01', category_id: 'wrong', limit_cop: 500 })))
        .status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ data: budgetId, error: null });
    const response = await POST(
      request('POST', { month: '2026-10-01', category_id: categoryId, limit_cop: 500 }),
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('create_monthly_budget', {
      p_month: '2026-10-01',
      p_category_id: categoryId,
      p_limit_cop: 500,
      p_repeat_monthly: false,
    });
  });

  it('forwards monthly recurrence and rejects unknown cadence', async () => {
    const input = {
      month: '2026-10-01',
      category_id: categoryId,
      limit_cop: 500,
      repeat_monthly: true,
    };
    expect((await POST(request('POST', input))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'create_monthly_budget',
      expect.objectContaining({ p_repeat_monthly: true }),
    );
    expect((await POST(request('POST', { ...input, repeat_monthly: 'forever' }))).status).toBe(400);
  });

  it('stops recurrence from the selected month while retaining past months', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(
      (await DELETE(request('DELETE', { budget_id: budgetId, month: '2026-12-01' }))).status,
    ).toBe(200);
    expect(rpc).toHaveBeenCalledWith('stop_monthly_budget', {
      p_budget_id: budgetId,
      p_month: '2026-12-01',
    });
  });

  it('deactivates only a valid budget ID', async () => {
    expect((await DELETE(request('DELETE', { budget_id: 'wrong' }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect((await DELETE(request('DELETE', { budget_id: budgetId }))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('deactivate_monthly_budget', { p_budget_id: budgetId });
  });
});

describe('budget edits', () => {
  it('passes an explicit ID to the edit RPC and returns category collision as 409', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: budgetId, error: null });
    vi.mocked(getUserClient).mockResolvedValue({ userId: 'owner', supabase: { rpc } as never });
    const input = {
      budget_id: budgetId,
      month: '2026-10-01',
      category_id: categoryId,
      limit_cop: 700,
      repeat_monthly: false,
    };
    expect((await PATCH(request('PATCH', input))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('update_monthly_budget', {
      p_budget_id: budgetId,
      p_month: input.month,
      p_category_id: categoryId,
      p_limit_cop: 700,
      p_repeat_monthly: false,
    });
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'Already exists' } });
    expect((await PATCH(request('PATCH', input))).status).toBe(409);
    rpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'Budget not found' } });
    expect((await PATCH(request('PATCH', input))).status).toBe(404);
    rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'Terms acceptance required' },
    });
    expect((await PATCH(request('PATCH', input))).status).toBe(403);
  });
});
