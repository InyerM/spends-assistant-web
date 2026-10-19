import { z } from 'zod';
export const categoryReviewSchema = z.object({
  category_id: z.string().nullable(),
  description: z.string().max(500),
  notes: z.string().max(1500),
  explanation: z.string().min(1).max(1000),
  kind: z.enum(['expense', 'income', 'own_transfer', 'unknown']),
  evidence_ids: z.array(z.string()).max(8),
});
export type CategoryReview = z.infer<typeof categoryReviewSchema>;
export function isCardPayment(accountType: string | undefined, description: string): boolean {
  return (
    accountType === 'credit_card' &&
    /\b(?:abono|payment|pago|pagamento|repayment)\b/iu.test(description) &&
    !/\b(?:refund|reembolso|devoluci[oó]n|estorno)\b/iu.test(description)
  );
}
