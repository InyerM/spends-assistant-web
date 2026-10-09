import { useQuery } from '@tanstack/react-query';
import type { ReviewHistoryObservation } from '@/lib/document-review';
import type { ReconciliationCandidate } from '@/lib/document-reconciliation';

export interface DocumentObservation extends ReviewHistoryObservation {
  ordinal: number;
  amount: number | null;
  occurred_at_text: string | null;
  status: string;
  confidence: number;
  match_transaction_id?: string | null;
  counterparty: string | null;
  reference: string | null;
}

export interface StoredDocument {
  id: string;
  source_inbox_item_id?: string | null;
  file_name: string;
  mime_type?: string;
  document_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  document_observations: DocumentObservation[];
}

export interface DocumentSuggestionGroup {
  observation_id: string;
  status: string;
  candidates: ReconciliationCandidate[];
  total_candidates: number;
  search_limited: boolean;
  category_suggestion?: { type: string; categoryId: string; evidenceCount: number } | null;
}

export const documentKeys = {
  all: ['documents'] as const,
  list: () => ['documents', 'list'] as const,
  suggestions: (id: string) => ['documents', id, 'suggestions'] as const,
};

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Document request failed';
}

export async function fetchDocuments(): Promise<StoredDocument[]> {
  const response = await fetch('/api/documents');
  if (!response.ok) throw new Error(await responseError(response));
  const body = (await response.json()) as { data: StoredDocument[] };
  return body.data;
}

export async function fetchDocumentSuggestions(id: string): Promise<DocumentSuggestionGroup[]> {
  const response = await fetch(`/api/documents/${id}/suggestions`);
  if (!response.ok) throw new Error(await responseError(response));
  const body = (await response.json()) as { data: DocumentSuggestionGroup[] };
  return body.data;
}

export function useDocuments(): ReturnType<typeof useQuery<StoredDocument[]>> {
  return useQuery({ queryKey: documentKeys.list(), queryFn: fetchDocuments });
}

export function useDocumentSuggestions(
  id: string,
  enabled: boolean,
): ReturnType<typeof useQuery<DocumentSuggestionGroup[]>> {
  return useQuery({
    queryKey: documentKeys.suggestions(id),
    queryFn: () => fetchDocumentSuggestions(id),
    enabled,
    staleTime: 30_000,
  });
}
