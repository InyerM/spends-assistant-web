import { z } from 'zod';

const uuid = z.uuid();
const positiveMinor = z.string().regex(/^[1-9][0-9]{0,35}$/);
const sourceKind = z.enum([
  'ledger_transaction',
  'bank_notice',
  'cash',
  'receipt',
  'manual_recollection',
]);

const addEntry = z
  .object({
    action: z.literal('add_entry'),
    fund_id: uuid,
    kind: z.enum(['receipt', 'outlay', 'unknown_spend']),
    occurred_on: z.iso.date().nullable(),
    amount_minor: positiveMinor.nullable(),
    description: z.string().trim().min(1).max(500),
    source_kind: sourceKind,
    source_reference: z.string().trim().min(1).max(500),
    transaction_id: uuid.nullable(),
  })
  .superRefine((entry, context) => {
    if (entry.kind === 'unknown_spend' && entry.amount_minor !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Unknown spending cannot have an invented amount',
      });
    }
    if (entry.kind !== 'unknown_spend' && entry.amount_minor === null) {
      context.addIssue({
        code: 'custom',
        message: 'A known receipt or outlay needs an exact amount',
      });
    }
    if (entry.kind !== 'unknown_spend' && entry.occurred_on === null) {
      context.addIssue({ code: 'custom', message: 'A known receipt or outlay needs a date' });
    }
    if ((entry.source_kind === 'ledger_transaction') !== (entry.transaction_id !== null)) {
      context.addIssue({ code: 'custom', message: 'Transaction ID and ledger source must match' });
    }
    if (entry.kind === 'unknown_spend' && entry.transaction_id !== null) {
      context.addIssue({ code: 'custom', message: 'Unknown spending cannot link a transaction' });
    }
  });

export const reliefFundEventSchema = z.union([
  z.object({
    action: z.literal('create_fund'),
    title: z.string().trim().min(1).max(120),
    purpose: z.string().trim().min(1).max(500),
    currency: z.literal('COP'),
  }),
  addEntry,
]);

export const reliefFundConfirmSchema = z.object({
  request_id: uuid,
  reviewed: z.literal(true),
  event: reliefFundEventSchema,
});

export type ReliefFundEvent = z.infer<typeof reliefFundEventSchema>;

export function summarizeReliefFund(
  entries: ReadonlyArray<{
    kind: 'receipt' | 'outlay' | 'unknown_spend';
    amount_minor: string | null;
  }>,
): {
  receiptsMinor: string;
  outlaysMinor: string;
  knownRemainderMinor: string;
  unknownSpendCount: number;
  actualRemainderKnown: boolean;
} {
  let receipts = BigInt(0);
  let outlays = BigInt(0);
  let unknown = 0;
  for (const entry of entries) {
    if (entry.kind === 'unknown_spend') {
      unknown += 1;
    } else if (entry.kind === 'receipt' && entry.amount_minor !== null) {
      receipts += BigInt(entry.amount_minor);
    } else if (entry.kind === 'outlay' && entry.amount_minor !== null) {
      outlays += BigInt(entry.amount_minor);
    }
  }
  return {
    receiptsMinor: receipts.toString(),
    outlaysMinor: outlays.toString(),
    knownRemainderMinor: (receipts - outlays).toString(),
    unknownSpendCount: unknown,
    actualRemainderKnown: unknown === 0,
  };
}
