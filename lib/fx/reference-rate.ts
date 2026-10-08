export interface UsdCopReferenceRate {
  requested_date: string;
  observed_date: string;
  rate: number;
  base: 'USD';
  quote: 'COP';
  provider: 'BANREP';
  basis: 'reference_only';
}

type RateFetcher = (
  input: string,
  init: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function fetchUsdCopReferenceRate(
  requestedDate: string,
  fetcher: RateFetcher = fetch,
): Promise<UsdCopReferenceRate> {
  if (!validDate(requestedDate)) throw new Error('Invalid reference rate date');

  const url = `https://api.frankfurter.dev/v2/providers/banrep/rate/usd/cop?date=${requestedDate}`;
  const response = await fetcher(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Reference rate unavailable');

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Invalid reference rate response');
  const quote = payload as Record<string, unknown>;
  if (
    quote.base !== 'USD' ||
    quote.quote !== 'COP' ||
    typeof quote.date !== 'string' ||
    !validDate(quote.date) ||
    quote.date > requestedDate ||
    typeof quote.rate !== 'number' ||
    !Number.isFinite(quote.rate) ||
    quote.rate <= 0
  ) {
    throw new Error('Invalid reference rate response');
  }

  return {
    requested_date: requestedDate,
    observed_date: quote.date,
    rate: quote.rate,
    base: 'USD',
    quote: 'COP',
    provider: 'BANREP',
    basis: 'reference_only',
  };
}
