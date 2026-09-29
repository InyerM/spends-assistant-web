import { describe, expect, it } from 'vitest';
import { extractCandidateEvidence, rankCandidates } from '@/lib/shortcut-inbox/candidates';

const transaction = (id: string) => ({
  id,
  date: '2024-11-23',
  amount: 119000,
  account_id: 'account-a',
  description: 'Synthetic merchant',
  type: 'expense',
  source: 'sms-shortcut',
});

describe('Shortcut inbox candidate evidence', () => {
  it('extracts explicit purchase amount, calendar date, and masked account suffix', () => {
    expect(
      extractCandidateEvidence(
        'Bancolombia: Compraste $119.000,00 en Synthetic Store con tu T.Deb *1234, el 23/11/2024',
      ),
    ).toEqual({
      amount: '119000.00',
      date: '2024-11-23',
      lastFour: '1234',
    });
  });

  it('does not mistake a Nequi balance for the payment amount', () => {
    expect(
      extractCandidateEvidence('Nequi: Pagaste $50.000 en Synthetic Store. Saldo: $900.000'),
    ).toEqual({
      amount: '50000.00',
      date: null,
      lastFour: null,
    });
  });

  it('does not infer transaction fields from an informational balance message', () => {
    expect(extractCandidateEvidence('Saldo disponible $900.000 al 23/11/2024')).toEqual({
      amount: null,
      date: null,
      lastFour: null,
    });
  });

  it('withholds ambiguous amount and date evidence', () => {
    expect(
      extractCandidateEvidence(
        'Compraste $20.000 y pagaste $30.000 con T.Deb *1234 el 23/11/2024 y 24/11/2024',
      ),
    ).toEqual({
      amount: null,
      date: null,
      lastFour: '1234',
    });
  });

  it('keeps two same-value payments as separate possible matches', () => {
    const result = rankCandidates([], [transaction('tx-a'), transaction('tx-b')], 10);
    expect(result).toHaveLength(2);
    expect(result.every((candidate) => candidate.strength === 'possible')).toBe(true);
    expect(
      result.every((candidate) => candidate.signals.includes('same_amount_date_account')),
    ).toBe(true);
  });

  it('combines exact-message and tuple evidence without calling a match confirmed', () => {
    const result = rankCandidates(
      [transaction('tx-a')],
      [transaction('tx-a'), transaction('tx-b')],
      10,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'tx-a',
      strength: 'strong',
      signals: ['exact_raw_text', 'same_amount_date_account'],
    });
    expect(result[1]).toMatchObject({ id: 'tx-b', strength: 'possible' });
  });

  it('caps and orders output without a confirmed duplicate decision', () => {
    const rows = Array.from({ length: 15 }, (_, index) => transaction(`tx-${index}`));
    const result = rankCandidates([], rows, 10);
    expect(result).toHaveLength(10);
    expect(JSON.stringify(result)).not.toContain('confirmed');
  });
});
