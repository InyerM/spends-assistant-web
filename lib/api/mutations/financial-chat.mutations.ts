import { useMutation } from '@tanstack/react-query';

export interface FinancialChatRequest {
  question: string;
  month: string;
  corpusAcknowledged: boolean;
}
export interface FinancialChatResponse {
  answer: string;
  citations: Array<{ id: string; href: string; record: Record<string, unknown> }>;
  coverage: {
    month: string;
    asOf: string;
    truncated: boolean;
    currencyBasis: string;
    gaps: string[];
    counts: { transactions: number; accounts: number; documents: number };
  };
}
export async function askFinancialChat(body: FinancialChatRequest): Promise<FinancialChatResponse> {
  const response = await fetch('/api/financial-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<FinancialChatResponse>;
}
export function useFinancialChat(): ReturnType<
  typeof useMutation<FinancialChatResponse, Error, FinancialChatRequest>
> {
  return useMutation({ mutationFn: askFinancialChat, retry: false, gcTime: 0 });
}
