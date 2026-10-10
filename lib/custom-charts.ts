export interface CustomChart {
  id: string;
  name: string;
  currency: 'COP' | 'USD';
  type: 'expense' | 'income';
  group: 'category' | 'account';
  account: string;
}
export interface ChartTransaction {
  type: string;
  amount: number;
  currency: string;
  account: string;
  category: string;
}
export function customCharts(value: unknown): CustomChart[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value
    .filter((item: unknown): item is CustomChart => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      const valid =
        typeof row.id === 'string' &&
        row.id.length <= 80 &&
        !ids.has(row.id) &&
        typeof row.name === 'string' &&
        row.name.trim().length > 0 &&
        row.name.length <= 80 &&
        (row.currency === 'COP' || row.currency === 'USD') &&
        (row.type === 'expense' || row.type === 'income') &&
        (row.group === 'category' || row.group === 'account') &&
        typeof row.account === 'string';
      if (valid) ids.add(row.id as string);
      return valid;
    })
    .slice(0, 3);
}
export function chartTotals(
  config: CustomChart,
  transactions: ChartTransaction[],
): { id: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (
      tx.type !== config.type ||
      tx.currency !== config.currency ||
      (config.account && tx.account !== config.account) ||
      !Number.isFinite(tx.amount)
    )
      continue;
    const key = config.group === 'account' ? tx.account : tx.category;
    totals.set(key, (totals.get(key) ?? 0) + Math.round(Math.abs(tx.amount) * 100));
  }
  return [...totals]
    .map(([id, cents]) => ({ id, amount: cents / 100 }))
    .sort((a, b) => b.amount - a.amount);
}
