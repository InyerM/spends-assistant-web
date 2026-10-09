import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
export interface SavedFinancialChat {
  id: string;
  month: string;
  question: string;
  answer: string;
  insufficient_context: boolean;
  citation_ids: string[];
  created_at: string;
}
interface HistoryPage {
  data: SavedFinancialChat[];
  hasMore: boolean;
}
export async function loadChatHistory(page: number): Promise<HistoryPage> {
  const response = await fetch(`/api/financial-chat/history?page=${page}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load chat history');
  return response.json() as Promise<HistoryPage>;
}
export async function deleteSavedChat(id: string): Promise<void> {
  const response = await fetch('/api/financial-chat/history', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Could not delete chat');
}
export function useChatHistory(page: number): UseQueryResult<HistoryPage, Error> {
  return useQuery({
    queryKey: ['financial-chat-history', page],
    queryFn: () => loadChatHistory(page),
    gcTime: 0,
  });
}
export function useDeleteChat(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteSavedChat,
    onSuccess: () => client.invalidateQueries({ queryKey: ['financial-chat-history'] }),
  });
}
