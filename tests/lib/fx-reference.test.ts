import { afterEach, expect, it, vi } from 'vitest';
import { fetchUsdCopReference } from '@/lib/fx-reference';
afterEach(() => vi.unstubAllGlobals());
it('uses the dated public reference and never labels it as a bank settlement rate', async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json([
      {
        valor: '4000.25',
        unidad: 'COP',
        vigenciadesde: '2026-09-01T00:00:00.000',
        vigenciahasta: '2026-09-01T00:00:00.000',
      },
    ]),
  );
  vi.stubGlobal('fetch', fetch);
  expect(await fetchUsdCopReference('2026-09-01')).toMatchObject({
    rate: 4000.25,
    date: '2026-09-01',
    approximate: true,
  });
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(url.hostname).toBe('www.datos.gov.co');
  expect(url.searchParams.get('$where')).toContain('2026-09-01');
});
it('rejects a malformed date and a rate outside the requested validity period', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json([
        { valor: '4000', unidad: 'COP', vigenciadesde: '2026-09-02', vigenciahasta: '2026-09-02' },
      ]),
    );
  vi.stubGlobal('fetch', fetch);
  expect(await fetchUsdCopReference('invalid')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(await fetchUsdCopReference('2026-09-01')).toBeNull();
});
