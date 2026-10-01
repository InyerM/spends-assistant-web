import { describe, expect, it } from 'vitest';
import { dateWindow, rankCandidates } from '@/lib/document-reconciliation';

const observation = {
  id: 'observation-1',
  amount: 12000,
  occurred_at_text: '2026-09-28',
  description: 'Coffee shop',
  counterparty: 'Cafe North',
  reference: 'ABC12345',
};

const transaction = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  amount: 12000,
  date: '2026-09-28',
  description: 'Cafe North coffee',
  account_id: 'account-1',
  account_name: 'Checking',
  type: 'expense',
  raw_text: 'Payment ABC12345',
  ...overrides,
});

describe('document reconciliation candidates', () => {
  it('accepts only real ISO dates and builds a three-day window', () => {
    expect(dateWindow('2026-09-28')).toEqual({ from: '2026-09-25', to: '2026-10-01' });
    expect(dateWindow('2026-02-30')).toBeNull();
    expect(dateWindow('09/28/2026')).toBeNull();
  });

  it('returns an exact amount and date match as an unconfirmed candidate', () => {
    expect(rankCandidates(observation, [transaction('tx-1')])).toMatchObject([
      {
        transaction_id: 'tx-1',
        kind: 'candidate',
        basis: 'exact_date',
        amount_difference: 0,
        reference_hint: true,
      },
    ]);
  });

  it('matches a signed bank debit to an expense with its absolute amount', () => {
    expect(
      rankCandidates({ ...observation, amount: -12000 }, [
        transaction('expense'),
        transaction('income', { type: 'income' }),
      ]).map((candidate) => candidate.transaction_id),
    ).toEqual(['expense']);
  });

  it('excludes false positives with a different amount or distant date', () => {
    expect(
      rankCandidates(observation, [
        transaction('wrong-amount', { amount: 12001 }),
        transaction('wrong-date', { date: '2026-09-20' }),
      ]),
    ).toEqual([]);
  });

  it('keeps ambiguous exact matches visible and uses text only to rank them', () => {
    const result = rankCandidates(observation, [
      transaction('weak', { description: 'Store', raw_text: '' }),
      transaction('strong'),
    ]);
    expect(result.map((candidate) => candidate.transaction_id)).toEqual(['strong', 'weak']);
    expect(result.map((candidate) => candidate.kind)).toEqual(['candidate', 'candidate']);
  });

  it('does not let a reference hint override a closer date', () => {
    const result = rankCandidates(observation, [
      transaction('near-reference', { date: '2026-09-29' }),
      transaction('exact-date', { raw_text: '', description: 'Other' }),
    ]);
    expect(result.map((candidate) => candidate.transaction_id)).toEqual([
      'exact-date',
      'near-reference',
    ]);
  });

  it('keeps multiple receipts independent instead of consuming a transaction', () => {
    const first = rankCandidates(observation, [transaction('tx-1')]);
    const second = rankCandidates({ ...observation, id: 'observation-2' }, [transaction('tx-1')]);
    expect(first[0].transaction_id).toBe('tx-1');
    expect(second[0].transaction_id).toBe('tx-1');
  });

  it('shows amount-only candidates if the OCR date is ambiguous', () => {
    const result = rankCandidates({ ...observation, occurred_at_text: '28/09/26' }, [
      transaction('tx-1'),
    ]);
    expect(result[0].basis).toBe('amount_only');
  });
});
