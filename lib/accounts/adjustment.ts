export function buildBalanceAdjustment(
  input: string,
  sign: '+' | '-',
  currentBalance: number,
): { target: number; amount: number; type: 'income' | 'expense' } | null {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount > 9999999999999.99) return null;
  const target = sign === '-' ? -amount : amount;
  const difference = Math.round(target * 100) - Math.round(currentBalance * 100);
  return {
    target,
    amount: Math.abs(difference) / 100,
    type: difference < 0 ? 'expense' : 'income',
  };
}
