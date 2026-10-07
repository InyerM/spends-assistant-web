import { z } from 'zod';

export const accountIdentifiersSchema = z
  .array(
    z
      .object({
        kind: z.enum(['bank_account', 'debit_card', 'credit_card', 'other']),
        last_four: z.string().regex(/^\d{4}$/u),
        is_active: z.boolean(),
        is_primary: z.boolean(),
      })
      .strict(),
  )
  .max(12)
  .superRefine((items, context) => {
    if (
      new Set(items.map((item) => item.last_four)).size !== items.length ||
      (items.length > 0 &&
        items.filter((item) => item.is_primary && item.is_active).length !== 1) ||
      items.some((item) => item.is_primary && !item.is_active)
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid account identifiers' });
    }
  });
