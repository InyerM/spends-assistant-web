import { expect, it } from 'vitest';
import { detectStatementHints, classifyStatementActivity } from '@/lib/statement-hints';
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
it('reads a billed cycle with abbreviated months and a shared year, ignoring the payment deadline', () => {
  expect(
    detectStatementHints(
      'Información de la Tarjeta *1506\nPeriodo facturado\n17 ago. - 15 sep. 2026\nPagar antes de: oct. 05, 2026',
      [{ id: 'card', is_active: true, last_four: '1506' }],
    ),
  ).toMatchObject({
    account_id: 'card',
    period_start: '2026-08-17',
    period_end: '2026-09-15',
    cycle: 'monthly',
  });
});
it('keeps an abbreviated December to January cycle in the correct years', () => {
  expect(detectStatementHints('Periodo facturado 17 dic - 15 ene 2026', [])).toMatchObject({
    period_start: '2025-12-17',
    period_end: '2026-01-15',
    cycle: 'monthly',
  });
});
it('does not treat a zero balance as proof that a statement has no movements', () => {
  expect(
    classifyStatementActivity(
      'Periodo facturado 17 ago - 15 sep 2026\nDeuda a la fecha de corte $0,00\n02/09/2026 Compra $15.900,00',
    ),
  ).toBe('movements');
  expect(
    classifyStatementActivity(
      'Periodo facturado 17 ago - 15 sep 2026\nDeuda a la fecha de corte $0,00\nPago total $0,00\nDetalle del pago mínimo\nSin movimientos',
    ),
  ).toBe('empty');
  expect(classifyStatementActivity('Unrecognized statement content')).toBe('unknown');
});
it('reads the billed period when adjacent PDF column headings interrupt the label', () => {
  const result = detectStatementHints(
    'Moneda: PESOS\nDeuda a la fecha de corte: Periodo facturado Pago Total:\n17 ago - 15 sep. 2026 $ 0,00',
    [],
  );
  expect(result).toMatchObject({
    period_start: '2026-08-17',
    period_end: '2026-09-15',
    cycle: 'monthly',
  });
});
