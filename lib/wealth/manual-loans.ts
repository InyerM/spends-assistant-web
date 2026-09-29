import { z } from 'zod';

const uuid = z.uuid();
const date = z.iso.date();
const units = z.string().regex(/^(0|[1-9]\d{0,37})$/);
const positive = z.string().regex(/^[1-9]\d{0,37}$/);
const evidence = z.object({
  kind: z.enum(['manual_review', 'statement']),
  reference: z.string().trim().min(1).max(500),
  observed_on: date,
});

export const loanEventSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_loan'),
    lender: z.enum(['lulo_bank', 'bancolombia']),
    label: z.string().trim().min(1).max(100),
    currency: z.string().regex(/^[A-Z]{3}$/),
    money_scale: z.number().int().min(0).max(6),
    evidence,
  }),
  z.object({
    action: z.literal('opening'),
    loan_id: uuid,
    occurred_on: date,
    outstanding_minor: positive,
    evidence,
  }),
  z
    .object({
      action: z.literal('payment'),
      loan_id: uuid,
      occurred_on: date,
      cash_paid_minor: positive,
      principal_minor: units,
      interest_minor: units,
      insurance_minor: units,
      fee_minor: units,
      evidence,
    })
    .refine(
      (event) =>
        BigInt(event.principal_minor) +
          BigInt(event.interest_minor) +
          BigInt(event.insurance_minor) +
          BigInt(event.fee_minor) ===
        BigInt(event.cash_paid_minor),
      { message: 'Payment components must equal the recorded cash paid' },
    ),
]);

export const loanConfirmSchema = z.object({
  request_id: uuid,
  reviewed: z.literal(true),
  event: loanEventSchema,
});
export type LoanEventDraft = z.infer<typeof loanEventSchema>;
