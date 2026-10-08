import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/fx/reference-rate/route';
import { AuthError, getUserClient } from '@/lib/api/server';
import { fetchUsdCopReferenceRate } from '@/lib/fx/reference-rate';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));
vi.mock('@/lib/fx/reference-rate', () => ({ fetchUsdCopReferenceRate: vi.fn() }));

function request(date: string): NextRequest {
  return new NextRequest(`http://localhost/api/fx/reference-rate?date=${date}`);
}

describe('/api/fx/reference-rate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUserClient).mockResolvedValue({ userId: 'owner', supabase: {} as never });
    vi.mocked(fetchUsdCopReferenceRate).mockResolvedValue({
      requested_date: '2026-10-04',
      observed_date: '2026-10-03',
      rate: 3273.49,
      base: 'USD',
      quote: 'COP',
      provider: 'BANREP',
      basis: 'reference_only',
    });
  });

  it('serves an authenticated reference quote with its publication date', async () => {
    const response = await GET(request('2026-10-04'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(fetchUsdCopReferenceRate).toHaveBeenCalledWith('2026-10-04');
    expect(await response.json()).toMatchObject({
      observed_date: '2026-10-03',
      basis: 'reference_only',
    });
  });

  it('rejects malformed dates before fetching a quote', async () => {
    expect((await GET(request('2026-02-30'))).status).toBe(400);
    expect(fetchUsdCopReferenceRate).not.toHaveBeenCalled();
  });

  it('returns an unavailable response instead of inventing a rate', async () => {
    vi.mocked(fetchUsdCopReferenceRate).mockRejectedValue(new Error('Reference rate unavailable'));
    expect((await GET(request('2026-10-04'))).status).toBe(503);
  });

  it('does not fetch a quote for an unauthenticated caller', async () => {
    vi.mocked(getUserClient).mockRejectedValue(new AuthError('No session'));
    expect((await GET(request('2026-10-04'))).status).toBe(401);
    expect(fetchUsdCopReferenceRate).not.toHaveBeenCalled();
  });
});
