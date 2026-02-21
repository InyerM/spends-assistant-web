import type { AppliedRule } from '@/types';

export interface ParsedExpense {
  amount: number;
  description: string;
  category: string;
  original_date?: string | null;
  original_time?: string | null;
  confidence: number;
  payment_type?: string;
  bank?: string;
  type?: string;
}

export interface ParseResponse {
  parsed: ParsedExpense;
  resolved: {
    account_id?: string;
    category_id?: string;
    transfer_to_account_id?: string;
    transfer_id?: string;
    type?: string;
    notes?: string;
  };
  original?: {
    account_id?: string;
    category_id?: string;
  };
  applied_rules: AppliedRule[];
}

export interface FormFields {
  date: string;
  time: string;
  amount: number;
  description: string;
  notes: string;
  type: 'expense' | 'income' | 'transfer';
  account_id: string;
  category_id: string | undefined;
  transfer_to_account_id: string | undefined;
}

export function parseDateString(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  let year = parts[2];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

export function parseTimeString(timeStr: string): string {
  return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
}

export function buildFieldsFromParse(
  result: ParseResponse,
  currentTimes: { date: string; time: string },
): FormFields {
  const { parsed, resolved } = result;
  const date = parsed.original_date ? parseDateString(parsed.original_date) : currentTimes.date;
  const time = parsed.original_time ? parseTimeString(parsed.original_time) : currentTimes.time;
  const type = (resolved.type ?? parsed.type ?? 'expense') as 'expense' | 'income' | 'transfer';

  return {
    date,
    time,
    amount: parsed.amount,
    description: parsed.description,
    type,
    account_id: resolved.account_id ?? '',
    category_id: resolved.category_id,
    transfer_to_account_id: resolved.transfer_to_account_id,
    notes: resolved.notes ?? '',
  };
}

export const SKIPPED_REASON_KEYS: Record<string, string> = {
  spending_summary: 'skippedSpendingSummary',
  balance_inquiry: 'skippedBalanceInquiry',
  otp_code: 'skippedOtpCode',
  promotional: 'skippedPromotional',
  informational: 'skippedInformational',
};
