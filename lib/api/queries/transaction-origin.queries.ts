import { useQuery } from '@tanstack/react-query';

export interface TransactionOriginEvidence {
  document: { id: string; file_name: string; source_inbox_item_id: string | null } | null;
  inbox: { id: string; source: string; raw_text: string; received_at: string } | null;
}

export async function fetchTransactionOrigin(id: string): Promise<TransactionOriginEvidence> {
  const response = await fetch(`/api/transactions/${id}/origin`);
  if (!response.ok) throw new Error('Could not load transaction evidence');
  return response.json() as Promise<TransactionOriginEvidence>;
}

export function useTransactionOrigin(
  id: string,
): ReturnType<typeof useQuery<TransactionOriginEvidence>> {
  return useQuery({
    queryKey: ['transactions', 'origin', id],
    queryFn: () => fetchTransactionOrigin(id),
    enabled: !!id,
  });
}
