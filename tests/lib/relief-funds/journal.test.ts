import { describe, expect, it } from 'vitest';
import { reliefFundConfirmSchema, summarizeReliefFund } from '@/lib/relief-funds/journal';

const fundId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const entry = {
  action: 'add_entry',
  fund_id: fundId,
  kind: 'unknown_spend',
  occurred_on: null,
  amount_minor: null,
  description: 'Cash purchases; exact amount unknown',
  source_kind: 'manual_recollection',
  source_reference: 'Owner recollection',
  transaction_id: null,
};

describe('relief fund entry review', () => {
  it('requires explicit review and no invented amount for unknown spending', () => {
    expect(
      reliefFundConfirmSchema.safeParse({ request_id: requestId, reviewed: true, event: entry })
        .success,
    ).toBe(true);
    expect(
      reliefFundConfirmSchema.safeParse({ request_id: requestId, reviewed: false, event: entry })
        .success,
    ).toBe(false);
    expect(
      reliefFundConfirmSchema.safeParse({
        request_id: requestId,
        reviewed: true,
        event: { ...entry, amount_minor: '30000000' },
      }).success,
    ).toBe(false);
  });

  it('rejects invalid dates, decimal minor units and unsupported transaction links', () => {
    expect(
      reliefFundConfirmSchema.safeParse({
        request_id: requestId,
        reviewed: true,
        event: { ...entry, occurred_on: '2026-02-30' },
      }).success,
    ).toBe(false);
    expect(
      reliefFundConfirmSchema.safeParse({
        request_id: requestId,
        reviewed: true,
        event: { ...entry, kind: 'receipt', amount_minor: '100.25' },
      }).success,
    ).toBe(false);
    expect(
      reliefFundConfirmSchema.safeParse({
        request_id: requestId,
        reviewed: true,
        event: { ...entry, kind: 'receipt', amount_minor: '10000' },
      }).success,
    ).toBe(false);
    expect(
      reliefFundConfirmSchema.safeParse({
        request_id: requestId,
        reviewed: true,
        event: { ...entry, kind: 'receipt', amount_minor: '10000', transaction_id: fundId },
      }).success,
    ).toBe(false);
  });

  it('keeps known remainder separate from unknown cash spending', () => {
    const summary = summarizeReliefFund([
      { kind: 'receipt', amount_minor: '25000000' },
      { kind: 'receipt', amount_minor: '10000000' },
      { kind: 'outlay', amount_minor: '9050000' },
      { kind: 'unknown_spend', amount_minor: null },
    ]);
    expect(summary).toEqual({
      receiptsMinor: '35000000',
      outlaysMinor: '9050000',
      knownRemainderMinor: '25950000',
      unknownSpendCount: 1,
      actualRemainderKnown: false,
    });
  });
});
