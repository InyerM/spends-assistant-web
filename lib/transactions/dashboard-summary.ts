import type { Transaction } from '@/types';

type SummaryTransaction = Pick<Transaction, 'type' | 'amount' | 'financial_role'>;

export interface DashboardSummary {
  personalIncome: number;
  expenses: number;
  cashFlow: number;
}

export function calculateDashboardSummary(
  transactions: readonly SummaryTransaction[],
): DashboardSummary {
  let personalIncome = 0;
  let cashIncome = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      cashIncome += transaction.amount;
      if (
        transaction.financial_role !== 'receivable_principal_repayment' &&
        transaction.financial_role !== 'earmarked_relief_donation'
      ) {
        personalIncome += transaction.amount;
      }
    } else if (transaction.type === 'expense') {
      expenses += transaction.amount;
    }
  }

  return { personalIncome, expenses, cashFlow: cashIncome - expenses };
}
