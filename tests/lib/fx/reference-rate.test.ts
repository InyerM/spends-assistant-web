import { describe, expect, it, vi } from 'vitest';
import { fetchUsdCopReferenceRate } from '@/lib/fx/reference-rate';

describe('Banco de la República USD/COP reference rate', () => {
  it('keeps the requested date and the actual publication date separate', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ date: '2026-10-03', base: 'USD', quote: 'COP', rate: 3273.49 }),
    );

    const quote = await fetchUsdCopReferenceRate('2026-10-04', fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/providers/banrep/rate/usd/cop?date=2026-10-04',
      expect.objectContaining({ next: { revalidate: 3600 } }),
    );
    expect(quote).toEqual({
      requested_date: '2026-10-04',
      observed_date: '2026-10-03',
      rate: 3273.49,
      base: 'USD',
      quote: 'COP',
      provider: 'BANREP',
      basis: 'reference_only',
    });
  });

  it('rejects a mismatched pair, invalid rate, or a publication after the requested date', async () => {
    for (const payload of [
      { date: '2026-10-04', base: 'EUR', quote: 'COP', rate: 3273.49 },
      { date: '2026-10-04', base: 'USD', quote: 'COP', rate: 0 },
      { date: '2026-10-05', base: 'USD', quote: 'COP', rate: 3273.49 },
    ]) {
      await expect(
        fetchUsdCopReferenceRate('2026-10-04', async () => Response.json(payload)),
      ).rejects.toThrow(/reference rate/i);
    }
  });

  it('does not invent a quote when the provider is unavailable', async () => {
    await expect(
      fetchUsdCopReferenceRate('2026-10-04', async () => new Response(null, { status: 503 })),
    ).rejects.toThrow(/reference rate/i);
  });
});
