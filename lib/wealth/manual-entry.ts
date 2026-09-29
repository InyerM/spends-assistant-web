import { z } from 'zod';

const uuid = z.uuid();
const date = z.iso.date();
const nonnegativeUnits = z.string().regex(/^(0|[1-9]\d{0,37})$/);
const positiveUnits = z.string().regex(/^[1-9]\d{0,37}$/);
const currency = z.string().regex(/^[A-Z][A-Z0-9]{2,7}$/);

const evidence = z.object({
  kind: z.enum(['manual_review', 'statement', 'broker_report']),
  reference: z.string().trim().min(1).max(500),
  observed_on: date,
});

export const investmentEventSchema = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('create_position'),
      provider: z.enum(['tyba', 'binance']),
      symbol: z.string().trim().min(1).max(80),
      quote_currency: currency,
      quantity_scale: z.number().int().min(0).max(18),
      money_scale: z.number().int().min(0).max(18),
      evidence,
    }),
    z.object({
      action: z.literal('opening'),
      position_id: uuid,
      occurred_on: date,
      quantity_atoms: positiveUnits,
      cost_basis_minor: nonnegativeUnits,
      known_zero_basis: z.boolean().optional(),
      evidence,
    }),
    z.object({
      action: z.enum(['buy', 'sell']),
      position_id: uuid,
      occurred_on: date,
      quantity_atoms: positiveUnits,
      gross_minor: positiveUnits,
      fee_minor: nonnegativeUnits,
      evidence,
    }),
    z.object({
      action: z.literal('valuation'),
      position_id: uuid,
      as_of: date,
      market_value_minor: nonnegativeUnits,
      evidence,
    }),
  ])
  .refine(
    (event) =>
      event.action !== 'opening' ||
      event.cost_basis_minor !== '0' ||
      event.known_zero_basis === true,
    { message: 'A zero opening basis must be confirmed as known, not unknown' },
  );

export const investmentConfirmSchema = z.object({
  request_id: uuid,
  reviewed: z.literal(true),
  event: investmentEventSchema,
});

export type InvestmentEventDraft = z.infer<typeof investmentEventSchema>;
