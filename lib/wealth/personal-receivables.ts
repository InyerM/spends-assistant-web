import { z } from 'zod';

const positive = z.string().regex(/^[1-9]\d{0,37}$/);
const event = z.object({
  receivable_id: z.uuid(),
  source_transaction_id: z.uuid(),
  occurred_on: z.iso.date(),
  amount_minor: positive,
  evidence_reference: z.string().trim().min(1).max(500),
});

export const receivableEventSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_receivable'),
    borrower: z.string().trim().min(1).max(120),
    label: z.string().trim().min(1).max(120),
    currency: z.string().regex(/^[A-Z]{3}$/),
    money_scale: z.number().int().min(0).max(2),
  }),
  event.extend({ action: z.literal('disbursement') }),
  event.extend({ action: z.literal('repayment') }),
]);

export const receivableConfirmSchema = z.object({
  request_id: z.uuid(),
  reviewed: z.literal(true),
  event: receivableEventSchema,
});
export type ReceivableEventDraft = z.infer<typeof receivableEventSchema>;
