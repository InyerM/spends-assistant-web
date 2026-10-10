export interface Contact {
  id: string;
  identity_kind: 'account' | 'nequi' | 'payment_key' | 'merchant';
  identity_value: string;
  display_name: string;
  custom_name: string | null;
  name: string;
  movement_count: number;
  last_activity: string | null;
}
export interface ContactList {
  items: Contact[];
  count: number;
  scan: { total: number; scanned: number; unresolved: number };
}
export interface ContactDetail {
  contact: Contact;
  movement_count: number;
  totals: Array<{
    currency: string;
    count: number;
    expenses: number | null;
    income: number | null;
  }>;
  categories: Array<{
    category_id: string | null;
    name?: string | null;
    translations?: Record<string, string> | null;
    count: number;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    type: string;
    category_id: string | null;
  }>;
}
export interface ContactScanPage {
  processed: number;
  next: string | null;
  has_more: boolean;
}
