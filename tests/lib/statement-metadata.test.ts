import { expect, it } from 'vitest';
import { buildStatementMetadata, resolveStatementMetadata } from '@/lib/statement-metadata';
it('keeps reusable derived facts without a PDF password or page contents', () => {
  const result = buildStatementMetadata([
    'Cuenta *8887 Moneda: PESOS\nPeriodo: 01/09/2026 al 30/09/2026',
    'ESTADO DE CUENTA EN: DOLARES',
  ]);
  expect(result.currencies).toEqual(['COP', 'USD']);
  expect(JSON.stringify(result)).not.toMatch(/password|pages|Cuenta/);
  expect(
    resolveStatementMetadata(result, [{ id: 'a', is_active: true, last_four: '8887' }])?.hints
      .account_id,
  ).toBe('a');
  expect(resolveStatementMetadata({ password: 'secret' }, [])).toBeNull();
});
