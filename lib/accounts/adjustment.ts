export function buildBalanceAdjustment(
  input: string,
  sign: '+' | '-',
): { amount: number; type: 'income' | 'expense' } | null {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, type: sign === '+' ? 'income' : 'expense' };
}
