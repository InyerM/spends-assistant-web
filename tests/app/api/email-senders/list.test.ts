import { expect, it, vi } from 'vitest';
import { GET } from '@/app/api/email-senders/route';
const { getUserClient } = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));
it('reads only the authenticated owner confirmations with private caching', async () => {
  const eq = vi.fn().mockResolvedValue({
    data: [{ sender_address: 'notice@bank.example', bank_name: 'Bancolombia' }],
    error: null,
  });
  const from = vi.fn().mockReturnValue({ select: () => ({ eq }) });
  getUserClient.mockResolvedValue({ userId: 'owner-a', supabase: { from } });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(from).toHaveBeenCalledWith('email_sender_confirmations');
  expect(eq).toHaveBeenCalledWith('user_id', 'owner-a');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('reports a failed read instead of treating confirmations as absent', async () => {
  getUserClient.mockResolvedValue({
    userId: 'owner-a',
    supabase: {
      from: () => ({
        select: () => ({ eq: async () => ({ data: null, error: { code: 'error' } }) }),
      }),
    },
  });
  expect((await GET()).status).toBe(500);
});
