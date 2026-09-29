import { describe, expect, it } from 'vitest';
import {
  applyPositionTrade,
  applyLoanEvent,
  calculateNetWorthByCurrency,
  createAssetTransfer,
  valuePosition,
} from '@/lib/wealth/calculations';
import type { LoanState, PositionState } from '@/types/wealth';

const emptyPosition: PositionState = {
  quantityAtoms: '0',
  costBasisMinor: '0',
  realizedReturnMinor: '0',
};

const emptyLoan: LoanState = {
  outstandingMinor: '0',
  interestExpenseMinor: '0',
  insuranceExpenseMinor: '0',
  feeExpenseMinor: '0',
};

describe('investment position calculations', () => {
  it('adds buy fees to basis and subtracts sell fees from realized return', () => {
    const bought = applyPositionTrade(emptyPosition, {
      kind: 'buy',
      quantityAtoms: '100',
      grossMinor: '10000',
      feeMinor: '100',
    });
    const sold = applyPositionTrade(bought, {
      kind: 'sell',
      quantityAtoms: '40',
      grossMinor: '6000',
      feeMinor: '60',
    });

    expect(bought).toEqual({
      quantityAtoms: '100',
      costBasisMinor: '10100',
      realizedReturnMinor: '0',
    });
    expect(sold).toEqual({
      quantityAtoms: '60',
      costBasisMinor: '6060',
      realizedReturnMinor: '1900',
    });
  });

  it('preserves exact basis when the last fractional crypto units are sold', () => {
    const position: PositionState = {
      quantityAtoms: '1000000000000000000',
      costBasisMinor: '9999',
      realizedReturnMinor: '0',
    };
    const sold = applyPositionTrade(position, {
      kind: 'sell',
      quantityAtoms: '1000000000000000000',
      grossMinor: '12000',
      feeMinor: '1',
    });
    expect(sold).toEqual({ quantityAtoms: '0', costBasisMinor: '0', realizedReturnMinor: '2000' });
  });

  it('rejects a sale larger than the position', () => {
    expect(() =>
      applyPositionTrade(emptyPosition, {
        kind: 'sell',
        quantityAtoms: '1',
        grossMinor: '10',
        feeMinor: '0',
      }),
    ).toThrow('insufficient quantity');
  });

  it('computes unrealized return from an explicitly dated valuation', () => {
    const position: PositionState = {
      quantityAtoms: '10',
      costBasisMinor: '1000',
      realizedReturnMinor: '200',
    };
    expect(valuePosition(position, { asOf: '2026-09-28', marketValueMinor: '1250' })).toEqual({
      asOf: '2026-09-28',
      marketValueMinor: '1250',
      unrealizedReturnMinor: '250',
      realizedReturnMinor: '200',
    });
  });
});

describe('loan calculations', () => {
  it('treats disbursement as equal cash and liability increases, with no income', () => {
    const result = applyLoanEvent(emptyLoan, { kind: 'disbursement', principalMinor: '100000' });
    expect(result.state.outstandingMinor).toBe('100000');
    expect(result.cashDeltaMinor).toBe('100000');
    expect(result.spendingMinor).toBe('0');
  });

  it('allocates a payment to principal, interest, insurance, and fees', () => {
    const loan = { ...emptyLoan, outstandingMinor: '100000' };
    const result = applyLoanEvent(loan, {
      kind: 'payment',
      cashPaidMinor: '12000',
      principalMinor: '9000',
      interestMinor: '2000',
      insuranceMinor: '800',
      feeMinor: '200',
    });
    expect(result.state).toEqual({
      outstandingMinor: '91000',
      interestExpenseMinor: '2000',
      insuranceExpenseMinor: '800',
      feeExpenseMinor: '200',
    });
    expect(result.cashDeltaMinor).toBe('-12000');
    expect(result.spendingMinor).toBe('3000');
  });

  it('rejects an installment whose parts do not equal cash paid', () => {
    expect(() =>
      applyLoanEvent(emptyLoan, {
        kind: 'payment',
        cashPaidMinor: '12000',
        principalMinor: '9000',
        interestMinor: '2000',
        insuranceMinor: '800',
        feeMinor: '100',
      }),
    ).toThrow('payment allocation');
  });

  it('applies an extra principal payment without creating spending', () => {
    const result = applyLoanEvent(
      { ...emptyLoan, outstandingMinor: '100000' },
      {
        kind: 'payment',
        cashPaidMinor: '25000',
        principalMinor: '25000',
        interestMinor: '0',
        insuranceMinor: '0',
        feeMinor: '0',
      },
    );
    expect(result.state.outstandingMinor).toBe('75000');
    expect(result.spendingMinor).toBe('0');
  });
});

describe('asset transfers and net worth', () => {
  it('creates balanced asset postings with no spending', () => {
    expect(createAssetTransfer('bank', 'tyba', 'COP', '50000')).toEqual({
      postings: [
        { accountId: 'bank', currency: 'COP', deltaMinor: '-50000' },
        { accountId: 'tyba', currency: 'COP', deltaMinor: '50000' },
      ],
      spendingMinor: '0',
    });
  });

  it('keeps currencies separate when no exchange-rate evidence exists', () => {
    expect(
      calculateNetWorthByCurrency([
        { kind: 'asset', id: 'cash', currency: 'COP', valueMinor: '100000' },
        { kind: 'liability', id: 'loan', currency: 'COP', valueMinor: '40000' },
        { kind: 'asset', id: 'btc', currency: 'USD', valueMinor: '5000' },
      ]),
    ).toEqual({ COP: '60000', USD: '5000' });
  });
});
