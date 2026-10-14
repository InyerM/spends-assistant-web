import { expect, it } from 'vitest';
import { unrecognizedSourceAccount } from '@/lib/shortcut-inbox/unrecognized-account';
it('suggests the own origin account rather than a transfer beneficiary', () => {
  expect(
    unrecognizedSourceAccount(
      'Transferiste $36,000 desde tu cuenta *2651 a la cuenta *3248292427 el 01/10/26 a las 12:46.',
      [],
    ),
  ).toMatchObject({ last_four: '2651', kind: 'bank_account' });
  expect(
    unrecognizedSourceAccount('Transferencia a la cuenta *3248292427 por $36,000.', []),
  ).toBeNull();
});
it('recognizes existing active identifier aliases and preserves credit/debit distinction', () => {
  const account = {
    type: 'checking' as const,
    last_four: '9989',
    identifiers: [
      { kind: 'bank_account' as const, last_four: '2651', is_active: true, is_primary: false },
    ],
    is_active: true,
    deleted_at: null,
  };
  expect(unrecognizedSourceAccount('Pagaste $10000 desde tu cuenta *2651.', [account])).toBeNull();
  expect(unrecognizedSourceAccount('Compra por $10000 con tu T.Deb *8456.', [])).toMatchObject({
    last_four: '8456',
    kind: 'debit_card',
  });
  expect(
    unrecognizedSourceAccount('Compra por $10000. Origen tarjeta de crédito •8456.', []),
  ).toMatchObject({ kind: 'credit_card' });
});
it('does not suggest accounts when origin references conflict', () => {
  expect(
    unrecognizedSourceAccount('Pagaste $10000 desde tu cuenta *1234 o desde tu cuenta *5678.', []),
  ).toBeNull();
});

it('reactivates an existing alias once and preserves the current primary identifier', async () => {
  const { withSourceIdentifier } = await import('@/lib/shortcut-inbox/unrecognized-account');
  const account = {
    type: 'checking' as const,
    last_four: '1111',
    is_active: true,
    deleted_at: null,
    identifiers: [
      { kind: 'bank_account' as const, last_four: '1111', is_active: true, is_primary: true },
      { kind: 'bank_account' as const, last_four: '2651', is_active: false, is_primary: false },
    ],
  };
  const identifiers = withSourceIdentifier(account, {
    kind: 'bank_account',
    last_four: '2651',
    currency: 'COP',
  });
  expect(identifiers).toHaveLength(2);
  expect(identifiers[0].is_primary).toBe(true);
  expect(identifiers[1]).toMatchObject({ is_active: true, is_primary: false });
  expect(account.identifiers[1].is_active).toBe(false);
});

it('uses the suffix of explicit full own-account numbers and ignores incoming sender accounts', () => {
  expect(
    unrecognizedSourceAccount('Pagaste $10000 desde tu cuenta de ahorros 1234567890.', []),
  ).toMatchObject({ last_four: '7890', kind: 'bank_account' });
  expect(
    unrecognizedSourceAccount('Recibiste $10000 desde la cuenta *1234 de otra persona.', []),
  ).toBeNull();
  expect(unrecognizedSourceAccount('Consignaste $10000 desde tu cuenta *2651.', [])).toMatchObject({
    last_four: '2651',
    kind: 'bank_account',
  });
});
