export type LuloNoticeKind = 'card_purchase' | 'zero_amount_authorization' | 'needs_review';

export interface LuloNoticePreview {
  kind: LuloNoticeKind;
  confidence: 'structured' | 'low';
  messageReceivedAt: string;
  bankEventAt: string | null;
  merchant: string | null;
  cardLastFour: string | null;
  amountText: string | null;
  amountDecimal: string | null;
  currencySymbol: '$' | null;
  currencyCode: null;
  excerpts: {
    sender: string | null;
    subject: string | null;
    purchase: string | null;
    card: string | null;
    date: string | null;
    time: string | null;
  };
}

const months: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function oneLine(rawText: string, pattern: RegExp): RegExpMatchArray | null {
  const matches = [...rawText.matchAll(pattern)];
  return matches.length === 1 ? matches[0] : null;
}

function parseAmount(value: string): string | null {
  const digits = value.replace(/^\$[ \t]*/u, '');
  let decimal: string;
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/u.test(digits)) {
    decimal = digits.replaceAll(',', '');
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/u.test(digits)) {
    decimal = digits.replaceAll('.', '').replace(',', '.');
  } else if (/^\d+(?:[.,]\d{1,2})?$/u.test(digits)) {
    decimal = digits.replace(',', '.');
  } else {
    return null;
  }
  const amount = Number(decimal);
  return Number.isFinite(amount) && amount >= 0 && amount <= 9_999_999_999_999
    ? amount.toFixed(2)
    : null;
}

function parseEventAt(dateText: string | undefined, timeText: string | undefined): string | null {
  if (!dateText || !timeText) return null;
  const date = /^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/iu.exec(dateText.trim());
  const time = /^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/iu.exec(timeText.trim());
  if (!date || !time) return null;
  const day = Number(date[1]);
  const month = months[date[2].toLowerCase()];
  const year = Number(date[3]);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (
    !month ||
    year < 1900 ||
    year > 2100 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour < 1 ||
    hour > 12 ||
    minute > 59
  ) {
    return null;
  }
  const hour24 = (hour % 12) + (time[3].toLowerCase() === 'p' ? 12 : 0);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-05:00`;
}

/** A text preview, never proof of sender authenticity or card settlement. */
export function previewLuloNotice(
  source: string,
  rawText: string,
  receivedAt: string,
): LuloNoticePreview | null {
  if (source !== 'lulo-email-backfill' && source !== 'forwarded_email') return null;
  const forwarded = /^From \(unverified\): ([^\n]+)\n\n([^\n]+)\n\n([\s\S]*)$/u.exec(rawText);
  if (source === 'forwarded_email') {
    if (!forwarded) return null;
    rawText = `From: ${forwarded[1]}\nSubject: ${forwarded[2]}\n\n${decodeEmailEntities(forwarded[3])}`;
  }
  const sender = oneLine(rawText, /^From:[ \t]*(.+)$/gimu);
  const subject = oneLine(rawText, /^Subject:[ \t]*(.+)$/gimu);
  const purchase = oneLine(
    rawText,
    /^(Realizaste una compra en (.{1,100}?) por (\$[ \t]*[0-9][0-9.,]*))$/gimu,
  );
  const card = oneLine(rawText, /^(Origen tarjeta de cr[eé]dito[ \t]*[•*][ \t]*(\d{4}))$/gimu);
  const date = oneLine(rawText, /^(Fecha[ \t]+(.+))$/gimu);
  const time = oneLine(rawText, /^(Hora[ \t]+(.+))$/gimu);
  const senderAddress = sender?.[1].match(/<([^<>]+)>$/u)?.[1] ?? sender?.[1].trim();
  const amountText = purchase?.[3] ?? null;
  const amountDecimal = amountText ? parseAmount(amountText) : null;
  const bankEventAt = parseEventAt(date?.[2], time?.[2]);
  const merchant = purchase?.[2]?.trim() || null;
  const cardLastFour = card?.[2] ?? null;
  const structured =
    senderAddress?.toLowerCase() === 'notificaciones@lulobank.com' &&
    subject?.[1].trim().toLowerCase() === 'compra realizada' &&
    merchant !== null &&
    amountDecimal !== null &&
    cardLastFour !== null &&
    bankEventAt !== null &&
    Number.isFinite(Date.parse(receivedAt));
  return {
    kind: !structured
      ? 'needs_review'
      : amountDecimal === '0.00'
        ? 'zero_amount_authorization'
        : 'card_purchase',
    confidence: structured ? 'structured' : 'low',
    messageReceivedAt: receivedAt,
    bankEventAt,
    merchant,
    cardLastFour,
    amountText,
    amountDecimal,
    currencySymbol: amountText?.startsWith('$') ? '$' : null,
    currencyCode: null,
    excerpts: {
      sender: sender?.[0] ?? null,
      subject: subject?.[0] ?? null,
      purchase: purchase?.[1] ?? null,
      card: card?.[1] ?? null,
      date: date?.[1] ?? null,
      time: time?.[1] ?? null,
    },
  };
}
import { decodeEmailEntities } from './email-text';
