export interface HintAccount {
  id: string;
  is_active: boolean;
  last_four?: string | null;
  bank_account_last_four?: string | null;
  identifiers?: Array<{ last_four: string }>;
}
export interface StatementHints {
  account_id: string | null;
  last_four: string | null;
  period_start: string | null;
  period_end: string | null;
  cycle: 'monthly' | 'quarterly' | 'other' | null;
}
const months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
function date(value: string): string | null {
  const numeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value.trim());
  const named = /^(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})$/.exec(value.trim());
  const day = Number(numeric?.[1] ?? named?.[1]);
  const month = numeric ? Number(numeric[2]) : months.indexOf(named?.[2] ?? '') + 1;
  const year = Number(numeric?.[3] ?? named?.[3]);
  if (!year || month < 1 || month > 12 || day < 1) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCDate() === day && candidate.getUTCMonth() === month - 1
    ? candidate.toISOString().slice(0, 10)
    : null;
}
export function detectStatementHints(text: string, accounts: HintAccount[]): StatementHints {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const ids = new Set<string>();
  for (const match of normalized.matchAll(
    /(?:cuenta|account|tarjeta)(?:\s+(?:de|ahorros?|corriente|credito|numero|no\.?|nro\.?|number|ending|terminada|en))*\s*[:#*•.-]?\s*(\d[\d -]{3,24})/g,
  )) {
    const digits = match[1].replace(/\D/g, '');
    if (digits.length >= 4) ids.add(digits.slice(-4));
  }
  const matches = accounts.filter(
    (a) =>
      a.is_active &&
      [
        a.last_four,
        a.bank_account_last_four,
        ...(a.identifiers ?? []).map((i) => i.last_four),
      ].some((v) => v && ids.has(v)),
  );
  const unique = matches.length === 1 ? matches[0] : null;
  const range =
    /(?:periodo|period|desde|del|from)\s*[:-]?\s*((?:\d{1,2}[/-]\d{1,2}[/-]\d{4})|(?:\d{1,2}\s+(?:de\s+)?[a-z]+\s+(?:de\s+)?\d{4}))\s*(?:al|a|hasta|to|through|[-–])\s*((?:\d{1,2}[/-]\d{1,2}[/-]\d{4})|(?:\d{1,2}\s+(?:de\s+)?[a-z]+\s+(?:de\s+)?\d{4}))/.exec(
      normalized,
    );
  let start = range ? date(range[1]) : null;
  let end = range ? date(range[2]) : null;
  if (!start || !end || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 366) {
    start = null;
    end = null;
  }
  let cycle: StatementHints['cycle'] = null;
  if (start && end) {
    const first = new Date(start + 'T00:00:00Z');
    const last = new Date(end + 'T00:00:00Z');
    const span =
      (last.getUTCFullYear() - first.getUTCFullYear()) * 12 +
      last.getUTCMonth() -
      first.getUTCMonth() +
      1;
    const whole =
      first.getUTCDate() === 1 &&
      last.getUTCDate() ===
        new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 0)).getUTCDate();
    cycle = whole && span === 1 ? 'monthly' : whole && span === 3 ? 'quarterly' : 'other';
  }
  return {
    account_id: unique?.id ?? null,
    last_four: ids.size === 1 ? [...ids][0] : null,
    period_start: start,
    period_end: end,
    cycle,
  };
}
