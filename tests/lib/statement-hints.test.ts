import { expect, it } from 'vitest';
import { detectStatementHints } from '@/lib/statement-hints';
it('suggests a unique historical identifier and the explicit quarterly period', () => {
  const accounts = [
    {
      id: 'a',
      is_active: true,
      last_four: '9989',
      identifiers: [{ last_four: '2651', kind: 'bank_account', is_active: false }],
    },
  ];
  expect(
    detectStatementHints(
      'Cuenta de ahorros 1234562651\nPeriodo: 01/07/2026 al 30/09/2026',
      accounts,
    ),
  ).toMatchObject({
    account_id: 'a',
    period_start: '2026-07-01',
    period_end: '2026-09-30',
    cycle: 'quarterly',
  });
});
it('does not guess an ambiguous account, infer a cycle from transaction dates or accept impossible dates', () => {
  const accounts = [
    { id: 'a', is_active: true, last_four: '2651' },
    { id: 'b', is_active: true, last_four: '2651' },
  ];
  expect(
    detectStatementHints('Cuenta *2651\n01/09/2026 compra 30/09/2026', accounts),
  ).toMatchObject({ account_id: null, period_start: null });
  expect(detectStatementHints('Periodo: 31/02/2026 al 31/03/2026', []).period_start).toBeNull();
});
it('reads Spanish month names and a labeled monthly range', () => {
  expect(
    detectStatementHints('PERÍODO DEL 1 de septiembre de 2026 AL 30 de septiembre de 2026', []),
  ).toMatchObject({ period_start: '2026-09-01', period_end: '2026-09-30', cycle: 'monthly' });
});
