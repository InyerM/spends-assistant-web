import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
export interface ConfirmedEmailSender {
  sender_address: string;
  bank_name: string;
  confirmed_at: string;
}
export function useEmailSenders(): {
  query: UseQueryResult<ConfirmedEmailSender[], Error>;
  confirm: UseMutationResult<ConfirmedEmailSender, Error, { inboxId: string; bankName: string }>;
} {
  const userId = useAuthStore((state) => state.supabaseUser?.id);
  const client = useQueryClient();
  const key = ['email-senders', userId ?? null];
  const query = useQuery<ConfirmedEmailSender[]>({
    queryKey: key,
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch('/api/email-senders', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load sender confirmations');
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid sender confirmations');
      return data as ConfirmedEmailSender[];
    },
  });
  const confirm = useMutation({
    mutationFn: async ({ inboxId, bankName }: { inboxId: string; bankName: string }) => {
      const response = await fetch(`/api/shortcut-inbox/${inboxId}/sender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank_name: bankName }),
      });
      if (!response.ok) throw new Error('Could not confirm sender');
      return (await response.json()) as ConfirmedEmailSender;
    },
    onSuccess: (sender) => {
      client.setQueryData<ConfirmedEmailSender[]>(key, (current) => [
        ...(current ?? []).filter((item) => item.sender_address !== sender.sender_address),
        sender,
      ]);
    },
  });
  return { query, confirm };
}
