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
  attachments?: Array<{ id: string; file_name: string; status: string }>;
  match?: { decision_id: string; transaction_id: string };
}

export interface InboxList {
  data: InboxItem[];
  count: number;
}
