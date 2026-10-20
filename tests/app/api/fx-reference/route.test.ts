import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), quote: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient: mocks.auth,
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/fx-reference', () => ({ fetchUsdCopReference: mocks.quote }));
import { AuthError } from '@/lib/api/server';
import { GET } from '@/app/api/fx-reference/route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({});
  mocks.quote.mockResolvedValue({ rate: 4000, date: '2026-09-01', approximate: true });
});
it('authenticates before fetching a strictly dated public reference', async () => {
  mocks.auth.mockRejectedValueOnce(new AuthError());
  expect((await GET(new Request('https://app.test/api/fx-reference?date=2026-09-01'))).status).toBe(
    401,
  );
  expect(mocks.quote).not.toHaveBeenCalled();
  expect((await GET(new Request('https://app.test/api/fx-reference?date=invalid'))).status).toBe(
    400,
  );
  expect(mocks.quote).not.toHaveBeenCalled();
  expect((await GET(new Request('https://app.test/api/fx-reference?date=2026-09-01'))).status).toBe(
    200,
  );
  expect(mocks.quote).toHaveBeenCalledWith('2026-09-01');
});
it('reports missing reference evidence without inventing a rate', async () => {
  mocks.quote.mockResolvedValueOnce(null);
  expect((await GET(new Request('https://app.test/api/fx-reference?date=2026-09-01'))).status).toBe(
    404,
  );
});
