import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shortcut-inbox/[id]/sender/route';
const { getUserClient, rpc } = vi.hoisted(() => ({ getUserClient: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));
const context = { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) };
const request = (body: unknown): Request =>
  new Request('https://example.test/sender', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  getUserClient.mockResolvedValue({ userId: 'owner-a', supabase: { rpc } });
  rpc.mockResolvedValue({
    data: { sender_address: 'notice@bank.example', bank_name: 'Bancolombia' },
    error: null,
  });
});
it('confirms the sender from the owner inbox instead of accepting a supplied address', async () => {
  const response = await POST(request({ bank_name: 'Bancolombia' }) as never, context);
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('confirm_email_sender', {
    p_inbox_item_id: '11111111-1111-4111-8111-111111111111',
    p_bank_name: 'Bancolombia',
  });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('rejects a spoofed owner/address and invalid bank text before writing', async () => {
  expect(
    (
      await POST(
        request({ bank_name: 'Bancolombia', sender_address: 'attacker@example.test' }) as never,
        context,
      )
    ).status,
  ).toBe(400);
  expect((await POST(request({ bank_name: '<script>' }) as never, context)).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('does not reveal a foreign inbox', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0002' } });
  expect((await POST(request({ bank_name: 'Bancolombia' }) as never, context)).status).toBe(404);
});
