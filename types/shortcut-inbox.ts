export interface InboxItem {
  id: string;
  source: string;
  external_id: string | null;
  received_at: string;
  raw_text: string;
  status: 'pending' | 'non_transaction' | 'dismissed' | 'matched' | 'created';
  created_at: string;
  match?: { decision_id: string; transaction_id: string };
}

export interface InboxList {
  data: InboxItem[];
  count: number;
}
