export interface RecipientHistoryRow {
  category_id: string | null;
  description: string;
  notes: string | null;
  raw_text: string | null;
}

export function recipientFromEmail(rawText: string): string | null {
  // Read explicit destinations only; owned source accounts and incoming keys are excluded.
  const recipients = [
    ...rawText.matchAll(
      /\b(?:a\s+la\s+cuenta\s*\*?|a\s+(?:la\s+)?(?:llave|nequi)\s*\*?)\s*(\d{4,12})\b/giu,
    ),
  ]
    .filter(
      (match) =>
        !/\bconectad[ao]\s*$/iu.test(rawText.slice(Math.max(0, match.index! - 20), match.index)),
    )
    .map((match) => match[1]);
  const unique = [...new Set(recipients)];
  return unique.length === 1 ? unique[0] : null;
}

/** History is a proposal. A divided history cannot establish a recipient category. */
export function suggestRecipientHistory(
  recipient: string,
  rows: RecipientHistoryRow[],
): RecipientHistoryRow | null {
  if (!/^\d{4,12}$/u.test(recipient)) return null;
  const matches = rows.filter(
    (row) => row.category_id && recipientFromEmail(row.raw_text ?? '') === recipient,
  );
  if (matches.length < 2) return null;
  const counts = new Map<string, number>();
  for (const row of matches) counts.set(row.category_id!, (counts.get(row.category_id!) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const [category, count] = ranked[0];
  if (ranked.length > 1 && (count < 3 || count / matches.length < 0.9)) return null;
  return matches.find((row) => row.category_id === category) ?? null;
}
