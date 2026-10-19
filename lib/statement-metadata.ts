import { z } from 'zod';
import {
  classifyStatementActivity,
  detectStatementHints,
  type HintAccount,
} from '@/lib/statement-hints';
const schema = z
  .object({
    version: z.literal(1),
    activity: z.enum(['empty', 'movements', 'unknown']),
    currencies: z.array(z.enum(['COP', 'USD'])).max(2),
    hints: z.object({
      account_id: z.null(),
      last_four: z
        .string()
        .regex(/^\d{4}$/)
        .nullable(),
      period_start: z.iso.date().nullable(),
      period_end: z.iso.date().nullable(),
      cycle: z.enum(['monthly', 'quarterly', 'other']).nullable(),
    }),
  })
  .strict();
export function buildStatementMetadata(pages: string[]): z.infer<typeof schema> {
  const text = pages.join('\n'),
    normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const currencies: Array<'COP' | 'USD'> = [];
  if (/\bCOP\b|\bpesos\b/i.test(normalized)) currencies.push('COP');
  if (/\bUSD\b|\bdolares\b|US\$/i.test(normalized)) currencies.push('USD');
  return {
    version: 1,
    hints: { ...detectStatementHints(text, []), account_id: null },
    activity: classifyStatementActivity(text),
    currencies,
  };
}
export function resolveStatementMetadata(
  value: unknown,
  accounts: HintAccount[],
): {
  hints: ReturnType<typeof detectStatementHints>;
  activity: 'empty' | 'movements' | 'unknown';
  currencies: Array<'COP' | 'USD'>;
} | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;
  const { hints, activity, currencies } = parsed.data;
  const matches = accounts.filter(
    (a) =>
      a.is_active &&
      [
        a.last_four,
        a.bank_account_last_four,
        ...(a.identifiers ?? []).map((i) => i.last_four),
      ].some((id) => id && id === hints.last_four),
  );
  return {
    hints: { ...hints, account_id: matches.length === 1 ? matches[0].id : null },
    activity,
    currencies,
  };
}
