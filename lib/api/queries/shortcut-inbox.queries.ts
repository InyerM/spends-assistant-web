import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import type { EmailMessageKind, InboxList } from '@/types/shortcut-inbox';

interface InboxFilters {
  page: number;
  kind?: EmailMessageKind;
  item_id?: string;
  status: string;
  source?: 'forwarded_email';
  search: string;
  date_from?: string;
  date_to?: string;
  sort?: 'newest' | 'oldest';
}

export async function fetchShortcutInbox(
  filters: InboxFilters,
  signal?: AbortSignal,
): Promise<InboxList> {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: '20',
    status: filters.status,
  });
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.item_id) params.set('item_id', filters.item_id);
  if (filters.source) params.set('source', filters.source);
  if (filters.search) params.set('q', filters.search);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  const response = await fetch(`/api/shortcut-inbox?${params}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Could not load inbox');
  return response.json() as Promise<InboxList>;
}

export function useShortcutInbox(filters: InboxFilters): ReturnType<typeof useQuery<InboxList>> {
  const userId = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['shortcut-inbox', userId ?? null, filters],
    queryFn: ({ signal }) => fetchShortcutInbox(filters, signal),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === (userId ?? null) ? previous : undefined,
    staleTime: 0,
  });
}
