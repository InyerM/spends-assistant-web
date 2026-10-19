export function transactionCurrencyTotals(
  rows: Array<{ currency?: string | null; type: string; amount: number }>,
): Array<{ currency: string; amount: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = row.currency ?? 'COP';
    if (row.type === 'transfer') continue;
    totals.set(
      currency,
      (totals.get(currency) ?? 0) + (row.type === 'expense' ? -row.amount : row.amount),
    );
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
