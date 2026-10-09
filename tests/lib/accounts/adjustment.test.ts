import { describe, expect, it } from 'vitest';
import { buildBalanceAdjustment } from '@/lib/accounts/adjustment';

describe('buildBalanceAdjustment', () => {
  it('derives the adjustment from the target instead of treating it as a delta', () => {
    expect(buildBalanceAdjustment('80', '+', 100)).toEqual({
      target: 80,
      amount: 20,
      type: 'expense',
    });
    expect(buildBalanceAdjustment('150', '+', 100)).toEqual({
      target: 150,
      amount: 50,
      type: 'income',
    });
  });
  it('supports zero, negative balances and exact cents', () => {
    expect(buildBalanceAdjustment('0', '+', 100)).toEqual({
      target: 0,
      amount: 100,
      type: 'expense',
    });
    expect(buildBalanceAdjustment('150', '-', -100)).toEqual({
      target: -150,
      amount: 50,
      type: 'expense',
    });
    expect(buildBalanceAdjustment('0.30', '+', 0.1)).toEqual({
      target: 0.3,
      amount: 0.2,
      type: 'income',
    });
  });
  it('returns a zero difference for unchanged targets', () => {
    expect(buildBalanceAdjustment('100', '+', 100)?.amount).toBe(0);
  });
  it('rejects malformed, imprecise and out of range input', () => {
    for (const input of ['', 'NaN', '500abc', '0.001', '10000000000000']) {
      expect(buildBalanceAdjustment(input, '+', 100)).toBeNull();
    }
  });
});
