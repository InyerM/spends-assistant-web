import { describe, expect, it } from 'vitest';
import { buildBalanceAdjustment } from '@/lib/accounts/adjustment';

describe('buildBalanceAdjustment', () => {
  it('uses a signed adjustment amount without deriving it from a displayed account balance', () => {
    expect(buildBalanceAdjustment('500', '+')).toEqual({ amount: 500, type: 'income' });
    expect(buildBalanceAdjustment('500', '-')).toEqual({ amount: 500, type: 'expense' });
  });

  it('rejects zero, nonnumeric, and partially numeric input', () => {
    expect(buildBalanceAdjustment('0', '+')).toBeNull();
    expect(buildBalanceAdjustment('not-a-number', '+')).toBeNull();
    expect(buildBalanceAdjustment('500abc', '+')).toBeNull();
  });
});
