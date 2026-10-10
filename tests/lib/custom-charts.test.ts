import { expect, it } from 'vitest';
import { customCharts, chartTotals } from '@/lib/custom-charts';
it('bounds chart preferences and keeps currencies, accounts and transaction types separate', () => {
  const config = {
    id: 'chart',
    name: 'Food',
    currency: 'COP',
    type: 'expense',
    group: 'category',
    account: 'a',
  };
  expect(customCharts([config, { ...config, currency: 'EUR' }])).toEqual([config]);
  expect(
    chartTotals(config as ReturnType<typeof customCharts>[number], [
      { type: 'expense', amount: 20, currency: 'COP', account: 'a', category: 'food' },
      { type: 'expense', amount: 3, currency: 'USD', account: 'a', category: 'food' },
      { type: 'expense', amount: 8, currency: 'COP', account: 'b', category: 'food' },
      { type: 'transfer', amount: 50, currency: 'COP', account: 'a', category: 'food' },
    ]),
  ).toEqual([{ id: 'food', amount: 20 }]);
});
