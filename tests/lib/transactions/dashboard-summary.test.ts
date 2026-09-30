import { describe, expect, it } from 'vitest';
import { calculateDashboardSummary } from '@/lib/transactions/dashboard-summary';

describe('dashboard summary', () => {
  it('keeps receivable principal and earmarked donations out of personal income', () => {
    expect(
      calculateDashboardSummary([
        { type: 'income', amount: 1_000_000, financial_role: null },
        { type: 'income', amount: 100_000, financial_role: 'receivable_principal_repayment' },
        { type: 'income', amount: 510_000, financial_role: 'earmarked_relief_donation' },
        { type: 'income', amount: 46_000, financial_role: 'personal_sale_proceeds' },
        { type: 'expense', amount: 300_000, financial_role: null },
        { type: 'transfer', amount: 50_000, financial_role: null },
      ]),
    ).toEqual({ personalIncome: 1_046_000, expenses: 300_000, cashFlow: 1_356_000 });
  });

  it('uses ordinary cash movement semantics when no review role exists', () => {
    expect(
      calculateDashboardSummary([
        { type: 'income', amount: 100, financial_role: null },
        { type: 'expense', amount: 40, financial_role: null },
      ]),
    ).toEqual({ personalIncome: 100, expenses: 40, cashFlow: 60 });
  });
});
