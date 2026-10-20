import { z } from 'zod';
export interface UsdCopReference {
  rate: number;
  date: string;
  approximate: true;
  source_url: string;
}
const rows = z.array(
  z.object({
    valor: z.string(),
    unidad: z.literal('COP'),
    vigenciadesde: z.string(),
    vigenciahasta: z.string(),
  }),
);
export async function fetchUsdCopReference(date: string): Promise<UsdCopReference | null> {
  if (!z.iso.date().safeParse(date).success) return null;
  const url = new URL('https://www.datos.gov.co/resource/32sa-8pi3.json');
  url.searchParams.set(
    '$where',
    `vigenciadesde <= '${date}T00:00:00' AND vigenciahasta >= '${date}T00:00:00'`,
  );
  url.searchParams.set('$limit', '1');
  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) return null;
    const parsed = rows.safeParse(await response.json());
    if (!parsed.success) return null;
    const row = parsed.data.at(0);
    if (!row) return null;
    const rate = Number(row.valor);
    if (
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > 100000 ||
      row.vigenciadesde.slice(0, 10) > date ||
      row.vigenciahasta.slice(0, 10) < date
    )
      return null;
    return {
      rate,
      date,
      approximate: true,
      source_url:
        'https://www.datos.gov.co/Econom-a-y-Finanzas/Tasa-de-Cambio-Representativa-del-Mercado-TRM/32sa-8pi3',
    };
  } catch {
    return null;
  }
}
