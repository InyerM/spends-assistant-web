import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';

export interface OwnerNotification {
  id: string;
  kind: 'email_received' | 'budget_near' | 'budget_exceeded';
  source_id: string;
  label: string;
  created_at: string;
  read_at: string | null;
}
export interface NotificationFilters {
  page: number;
  limit: number;
  unread: boolean;
}
export interface NotificationList {
  total_count: number;
  data: OwnerNotification[];
  unread_count: number;
  pending_email_count: number;
  budget_warning_count: number;
}
export async function fetchNotifications(
  signal?: AbortSignal,
  filters?: NotificationFilters,
): Promise<NotificationList> {
  const params = filters
    ? `?${new URLSearchParams({ page: String(filters.page), limit: String(filters.limit), unread: String(filters.unread) })}`
    : '';
  const response = await fetch(`/api/notifications${params}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Could not load notifications');
  return response.json() as Promise<NotificationList>;
}
export async function markNotificationsRead(id?: string): Promise<void> {
  const response = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(id ? { id } : {}),
  });
  if (!response.ok) throw new Error('Could not mark notifications read');
}
export function useNotifications(
  filters?: NotificationFilters,
): UseQueryResult<NotificationList, Error> {
  const userId = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['notifications', userId ?? null, filters ?? null],
    queryFn: ({ signal }) => fetchNotifications(signal, filters),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
export function useMarkNotificationsRead(): UseMutationResult<void, Error, string | undefined> {
  const userId = useAuthStore((state) => state.supabaseUser?.id);
  const client = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['notifications', userId ?? null] });
    },
  });
}
