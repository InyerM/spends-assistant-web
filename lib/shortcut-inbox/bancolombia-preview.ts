import { decodeEmailEntities } from './email-text';

export interface BancolombiaNoticePreview {
  kind: 'purchase' | 'transfer' | 'payment' | 'withdrawal' | 'income';
  amountDecimal: string | null;
  currency: 'COP' | 'USD';
  date: string | null;
  time: string | null;
  merchant: string | null;
  sourceLastFour: string | null;
  sourceKind: 'credit' | 'debit' | null;
  destinationLastFour?: string | null;
}

const kindByVerb = {
  compraste: 'purchase',
  transferiste: 'transfer',
  pagaste: 'payment',
  retiraste: 'withdrawal',
  recibiste: 'income',
  consignaste: 'income',
} as const;

function decimalAmount(token: string): string | null {
  let decimal: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/u.test(token)) {
    decimal = token.replaceAll('.', '').replace(',', '.');
  } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/u.test(token)) {
    decimal = token.replaceAll(',', '');
  } else if (/^\d+(?:[.,]\d{1,2})?$/u.test(token)) {
    decimal = token.replace(',', '.');
  } else return null;
  const amount = Number(decimal);
  return Number.isFinite(amount) && amount > 0 && amount <= 9_999_999_999_999
    ? amount.toFixed(2)
    : null;
}

function bankDate(day: string, month: string, rawYear: string): string | null {
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (year < 2000 || year > 2100 || monthNumber < 1 || monthNumber > 12) return null;
  if (dayNumber < 1 || dayNumber > new Date(Date.UTC(year, monthNumber, 0)).getUTCDate())
    return null;
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
}

/** Sender domains are parsing hints, not authenticity verification. */
export function isBancolombiaSender(rawText: string): boolean {
  return /^From \(unverified\): [^\n]*@(?:[a-z0-9-]+\.)?(?:notificacionesbancolombia\.com|bancolombia\.com\.co)\s*$/imu.test(
    rawText,
  );
}

/** Only the bank alert sentence is evidence; footer dates and masked values never fill fields. */
export function previewBancolombiaNotice(
  source: string,
  rawText: string,
): BancolombiaNoticePreview | null {
  if (source !== 'forwarded_email') return null;
  if (!isBancolombiaSender(rawText)) return null;
  const decoded = decodeEmailEntities(rawText).replace(/\s+/gu, ' ');
  const matches = [
    ...decoded.matchAll(
      /\bBancolombia:\s*(Compraste|Transferiste|Pagaste|Retiraste|Recibiste|Consignaste)\b/giu,
    ),
  ];
  if (matches.length !== 1) return null;
  const alert = decoded
    .slice(matches[0].index, matches[0].index + 550)
    .split(/\b(?:Si tienes dudas|¿Dudas\?|Estamos cerca|Controla tu dinero)\b/iu, 1)[0];
  const verb = matches[0][1].toLowerCase() as keyof typeof kindByVerb;
  const amountMatch = new RegExp(
    `^Bancolombia:\\s*${verb}\\s+(COP|USD|\\$)\\s*([0-9][0-9.,]*)`,
    'iu',
  ).exec(alert);
  const amountDecimal = amountMatch ? decimalAmount(amountMatch[2]) : null;
  const currency = amountMatch?.[1].toUpperCase() === 'USD' ? 'USD' : 'COP';
  const dateMatch =
    /\bel\s+(\d{2})\/(\d{2})\/(\d{4}|\d{2})\b(?:\s+(?:a las\s+)?(\d{1,2}):(\d{2})(?::\d{2})?\b)?/iu.exec(
      alert,
    );
  const date = dateMatch ? bankDate(dateMatch[1], dateMatch[2], dateMatch[3]) : null;
  const hour = Number(dateMatch?.[4]);
  const minute = Number(dateMatch?.[5]);
  const time =
    date && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
      ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      : null;
  const references = [
    ...[...alert.matchAll(/\bT\.\s*(Cred(?:ito)?|Deb(?:ito)?)\s*\*+\s*(\d{4})\b/giu)].map(
      (match) => ({
        kind: match[1].toLowerCase().startsWith('cred') ? ('credit' as const) : ('debit' as const),
        suffix: match[2],
      }),
    ),
    ...[...alert.matchAll(/\bdesde (?:tu|la) (?:cuenta\s*\*+|producto\s+)(\d{4})\b/giu)].map(
      (match) => ({
        kind: 'debit' as const,
        suffix: match[1],
      }),
    ),
  ];
  const sourceReference = [
    ...new Map(
      references.map((reference) => [`${reference.kind}:${reference.suffix}`, reference]),
    ).values(),
  ];
  const merchant =
    verb === 'compraste'
      ? (/\bCompraste\s+(?:COP|USD|\$)\s*[0-9][0-9.,]*\s+en\s+(.+?)(?=\s+con tu T\.|,\s*el\s+\d{2}\/)/iu
          .exec(alert)?.[1]
          ?.trim() ?? null)
      : null;
  return {
    kind: kindByVerb[verb],
    amountDecimal,
    currency,
    date,
    time,
    merchant,
    destinationLastFour:
      verb === 'pagaste'
        ? (/\ben la tarjeta de cr[eé]dito\s*\*+\s*(\d{4})\b/iu.exec(alert)?.[1] ?? null)
        : null,
    sourceLastFour: sourceReference.length === 1 ? sourceReference[0].suffix : null,
    sourceKind: sourceReference.length === 1 ? sourceReference[0].kind : null,
  };
}
