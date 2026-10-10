import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import type { ContactList, ContactDetail, ContactScanPage, ContactSort } from '@/types/contacts';
async function read<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Contacts unavailable');
  return response.json() as Promise<T>;
}
export function useContacts(
  search: string,
  page: number,
  sort: ContactSort = 'recent',
): UseQueryResult<ContactList> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['contacts', owner, search, page, sort],
    enabled: Boolean(owner),
    queryFn: ({ signal }) =>
      read<ContactList>(
        `/api/contacts?q=${encodeURIComponent(search)}&page=${page}&sort=${sort}`,
        signal,
      ),
  });
}
export function useContactDetail(id: string | null): UseQueryResult<ContactDetail> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['contact-detail', owner, id],
    enabled: Boolean(owner && id),
    queryFn: ({ signal }) => read<ContactDetail>(`/api/contacts/${id}`, signal),
  });
}
export async function scanContacts(onProgress: (count: number) => void): Promise<void> {
  let after: string | null = null;
  let processed = 0;
  for (;;) {
    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ after }),
    });
    if (!response.ok) throw new Error('Contact scan failed');
    const result = (await response.json()) as ContactScanPage;
    processed += result.processed;
    onProgress(processed);
    if (!result.has_more) return;
    if (!result.next || result.next === after) throw new Error('Contact scan cursor stalled');
    after = result.next;
  }
}
export async function renameContact(id: string, name: string): Promise<void> {
  const response = await fetch(`/api/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Contact update failed');
}

export function useContactSummary(): UseQueryResult<ContactList> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: ['contacts', owner, 'summary'],
    enabled: Boolean(owner),
    queryFn: ({ signal }) => read<ContactList>('/api/contacts?summary=1', signal),
  });
}
