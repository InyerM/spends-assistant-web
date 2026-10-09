import { useMutation } from '@tanstack/react-query';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';

export interface ForwardedEmailAnalysis {
  status: 'parsed' | 'needs_review';
  account_id: string | null;
  category_id: string | null;
  category_source: 'ai' | 'catalog' | 'automation' | 'review_context' | null;
  bank_event_at?: string | null;
  ai_status?: 'unavailable';
  analysis_source?: 'automation' | 'history' | 'ai' | 'evidence';
  automation_fields?: string[];
  history_fields?: string[];
  suggested_type: 'expense' | 'income' | null;
  description: string | null;
  notes: string | null;
}

export async function analyzeForwardedEmail(inboxId: string): Promise<ForwardedEmailAnalysis> {
  const response = await fetch(`/api/shortcut-inbox/${inboxId}/analyze`, {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const consentError = await aiConsentErrorFromResponse(response);
    throw consentError ?? new Error('Email analysis failed');
  }
  return (await response.json()) as ForwardedEmailAnalysis;
}

export function useAnalyzeForwardedEmail(): ReturnType<
  typeof useMutation<ForwardedEmailAnalysis, Error, string>
> {
  return useMutation({ mutationFn: analyzeForwardedEmail });
}

export interface CandidateReview {
  status: 'review_required' | 'review_overflow';
  candidate_hash?: string;
  candidate_count: number;
  candidates: Array<{
    id: string;
    date: string;
    amount: string;
    description: string;
    source: string;
  }>;
}

export interface CreateInboxTransactionInput {
  inboxId: string;
  account_id: string;
  category_id: string | null;
  transfer_to_account_id?: string;
  type: 'expense' | 'income' | 'transfer';
  amount: string;
  date: string;
  description: string;
  notes?: string;
  event_at?: string;
  event_time_confirmed?: true;
  reviewed_candidate_hash?: string;
  confirm_distinct?: true;
}

export async function createInboxTransaction({
  inboxId,
  ...body
}: CreateInboxTransactionInput): Promise<
  CandidateReview | { status: 'created'; transaction_id?: string; decision_id?: string }
> {
  const response = await fetch(`/api/shortcut-inbox/${inboxId}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as CandidateReview | { status?: string };
  if (
    response.status === 409 &&
    (result.status === 'review_required' || result.status === 'review_overflow')
  )
    return result as CandidateReview;
  if (!response.ok) throw new Error('Creation failed');
  const created = result as { transaction_id?: string; decision_id?: string };
  return {
    status: 'created',
    transaction_id: created.transaction_id,
    decision_id: created.decision_id,
  };
}

export function useCreateInboxTransaction(): ReturnType<
  typeof useMutation<
    CandidateReview | { status: 'created'; transaction_id?: string; decision_id?: string },
    Error,
    CreateInboxTransactionInput
  >
> {
  return useMutation({ mutationFn: createInboxTransaction });
}
