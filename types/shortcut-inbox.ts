export const EMAIL_MESSAGE_KINDS = [
  'purchase',
  'transfer',
  'income',
  'statement',
  'financial_document',
  'promotion',
  'informational',
  'security',
  'spam',
  'uncertain',
] as const;
export type EmailMessageKind = (typeof EMAIL_MESSAGE_KINDS)[number];

export interface InboxItem {
  id: string;
  message_kind?: EmailMessageKind;
  source: string;
  external_id: string | null;
  received_at: string;
  raw_text: string;
  status: 'pending' | 'non_transaction' | 'dismissed' | 'matched' | 'created';
  created_at: string;
  analysis?: InboxAnalysis;
  analysis_job?: InboxAnalysisJob;
  attachments?: Array<{ id: string; file_name: string; status: string }>;
  match?: { decision_id: string; transaction_id: string };
}

export interface InboxList {
  data: InboxItem[];
  count: number;
}

export interface InboxAnalysis {
  inbox_item_id?: string;
  analysis_version?: number;
  status: 'parsed' | 'needs_review';
  account_id: string | null;
  category_id: string | null;
  category_source: 'ai' | 'catalog' | 'automation' | 'review_context' | null;
  amount?: number | string | null;
  merchant?: string | null;
  bank_event_at?: string | null;
  card_last_four?: string | null;
  suggested_type: 'expense' | 'income' | null;
  description: string | null;
  notes: string | null;
  event_date?: string | null;
  explanation?: string | null;
  financial_type?: 'expense' | 'income' | 'transfer' | null;
  transfer_to_account_id?: string | null;
  merchant_source_url?: string;
  extraction_version?: number;
  ai_status?: 'unavailable';
  analysis_source?: 'automation' | 'history' | 'ai' | 'evidence';
  automation_fields?: string[];
  history_fields?: string[];
  applied_rules?: Array<{ rule_id: string; rule_name: string }>;
  evidence_ids?: string[];
}

export interface InboxAnalysisJob {
  state: 'pending' | 'running' | 'ready' | 'blocked' | 'failed' | 'skipped';
  attempts: number;
  last_error?: string | null;
  available_at?: string;
  updated_at?: string;
}
