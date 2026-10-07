import { describe, expect, it } from 'vitest';
import {
  accountIdentifiers,
  defaultIdentifierKind,
  matchesAccountSuffix,
  primarySuffix,
} from '@/lib/accounts/identifiers';

describe('account identifiers', () => {
  it('defaults a credit card to a credit card reference', () => {
    expect(defaultIdentifierKind('credit_card')).toBe('credit_card');
    expect(defaultIdentifierKind('savings')).toBe('bank_account');
  });
  const account = {
    type: 'savings' as const,
    last_four: '2651',
    bank_account_last_four: '2651',
    identifiers: [
      { kind: 'bank_account' as const, last_four: '2651', is_active: true, is_primary: true },
      { kind: 'debit_card' as const, last_four: '9989', is_active: true, is_primary: false },
      { kind: 'debit_card' as const, last_four: '7799', is_active: false, is_primary: false },
    ],
  };

  it('shows the bank account suffix and matches current and historic debit references', () => {
    expect(primarySuffix(account)).toBe('2651');
    expect(matchesAccountSuffix(account, '9989', 'debit')).toBe(true);
    expect(matchesAccountSuffix(account, '7799', 'debit')).toBe(true);
    expect(matchesAccountSuffix(account, '9989', 'credit')).toBe(false);
    expect(matchesAccountSuffix(account, '0000', 'debit')).toBe(false);
  });

  it('adapts old accounts without identifier records', () => {
    expect(
      accountIdentifiers({ type: 'savings', last_four: '7799', bank_account_last_four: '2651' }),
    ).toHaveLength(2);
  });
});
