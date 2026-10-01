import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH as patchInvestment } from '@/app/api/investments/[id]/route';
import { PATCH as patchLoan } from '@/app/api/loans/[id]/route';

const { getUserClient, rpc } = vi.hoisted(() => ({ getUserClient: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const id = '00000000-0000-4000-8000-000000000001';

describe('manual wealth record management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({ supabase: { rpc } });
    rpc.mockResolvedValue({ data: { id, action: 'rename' }, error: null });
  });

  it('passes an investment rename through the owner-scoped RPC', async () => {
    const request = new Request(`http://localhost/api/investments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'rename', label: 'Tyba Pocket' }),
    });
    const response = await patchInvestment(request, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('manage_manual_wealth_record', {
      p_kind: 'investment',
      p_id: id,
      p_action: 'rename',
      p_label: 'Tyba Pocket',
    });
  });

  it('rejects a loan action with unreviewed extra fields', async () => {
    const request = new Request(`http://localhost/api/loans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'archive', outstanding_minor: '0' }),
    });
    const response = await patchLoan(request, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
