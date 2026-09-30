import { describe, expect, it } from 'vitest';
import { calculateDashboardSummary, isPersonalExpense } from '@/lib/transactions/dashboard-summary';

describe('dashboard summary', () => {
  it('keeps receivable principal and earmarked donations out of personal income', () => {
    expect(
      calculateDashboardSummary([
        { type: 'income', amount: 1_000_000, financial_role: null },
        { type: 'income', amount: 100_000, financial_role: 'receivable_principal_repayment' },
        { type: 'income', amount: 510_000, financial_role: 'earmarked_relief_donation' },
        { type: 'income', amount: 46_000, financial_role: 'personal_sale_proceeds' },
        { type: 'expense', amount: 300_000, financial_role: null },
        { type: 'expense', amount: 800_000, financial_role: 'receivable_disbursement' },
        { type: 'expense', amount: 120_000, financial_role: 'earmarked_relief_outlay' },
        { type: 'transfer', amount: 50_000, financial_role: null },
      ]),
    ).toEqual({ personalIncome: 1_000_000, expenses: 300_000, cashFlow: 436_000 });
  });

  it('uses ordinary cash movement semantics when no review role exists', () => {
    expect(
      calculateDashboardSummary([
        { type: 'income', amount: 100, financial_role: null },
        { type: 'expense', amount: 40, financial_role: null },
      ]),
    ).toEqual({ personalIncome: 100, expenses: 40, cashFlow: 60 });
  });

  it('filters linked principal and relief spending from personal expense charts', () => {
    expect(isPersonalExpense({ type: 'expense', financial_role: null })).toBe(true);
    expect(isPersonalExpense({ type: 'expense', financial_role: 'receivable_disbursement' })).toBe(
      false,
    );
    expect(isPersonalExpense({ type: 'expense', financial_role: 'earmarked_relief_outlay' })).toBe(
      false,
    );
  });
});
