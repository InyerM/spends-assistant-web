import { useQuery } from '@tanstack/react-query';

interface MerchantSuggestion {
  category_id: string | null;
  source: 'ai' | 'catalog' | null;
}

export function useMerchantSuggestion(
  merchant: string | undefined,
  enabled: boolean,
  categoryScope = '',
): ReturnType<typeof useQuery<MerchantSuggestion>> {
  return useQuery({
    queryKey: ['merchant-suggestion', categoryScope, merchant?.trim().toLowerCase()],
    queryFn: async () => {
      const response = await fetch('/api/merchant-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: merchant?.trim() }),
      });
      if (!response.ok) throw new Error('Merchant suggestion failed');
      return (await response.json()) as MerchantSuggestion;
    },
    enabled: enabled && !!merchant?.trim() && !!categoryScope,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
