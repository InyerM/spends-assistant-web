export interface RecipientHistoryRow {
  category_id: string | null;
  description: string;
  notes: string | null;
  raw_text: string | null;
}

export function recipientFromEmail(rawText: string): string | null {
  const recipients = [...rawText.matchAll(/\ba\s+la\s+cuenta\s+\*(\d{4,12})\b/giu)];
  return recipients.length === 1 ? recipients[0][1] : null;
}

/** History remains a proposal; conflicting purposes never establish a recipient category. */
export function suggestRecipientHistory(
  recipient: string,
  rows: RecipientHistoryRow[],
): RecipientHistoryRow | null {
  if (!/^\d{4,12}$/u.test(recipient)) return null;
  const target = new RegExp(`\\b(?:a|hacia|destino)[\\s\\S]{0,45}\\*${recipient}(?!\\d)`, 'iu');
  const matches = rows.filter((row) => row.category_id && target.test(row.raw_text ?? ''));
  if (matches.length < 2 || new Set(matches.map((row) => row.category_id)).size !== 1) return null;
  return matches[0];
}
