import type { Transaction } from '@/types';

type SummaryTransaction = Pick<Transaction, 'type' | 'amount' | 'financial_role'>;

export function isPersonalExpense(
  transaction: Pick<Transaction, 'type' | 'financial_role'>,
): boolean {
  return (
    transaction.type === 'expense' &&
    transaction.financial_role !== 'receivable_disbursement' &&
    transaction.financial_role !== 'earmarked_relief_outlay'
  );
}

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
  let cashExpenses = 0;

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
      cashExpenses += transaction.amount;
      if (isPersonalExpense(transaction)) expenses += transaction.amount;
    }
  }

  return { personalIncome, expenses, cashFlow: cashIncome - cashExpenses };
}
