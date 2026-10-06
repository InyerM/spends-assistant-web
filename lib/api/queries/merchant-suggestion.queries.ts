import { useQuery } from '@tanstack/react-query';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';

interface MerchantSuggestion {
  category_id: string | null;
  source: 'ai' | 'catalog' | null;
}

interface MerchantSuggestionQuery {
  queryKey: readonly [string, string, string];
  queryFn: () => Promise<MerchantSuggestion>;
  retry: false;
  staleTime: number;
}

export function merchantSuggestionQuery(
  merchant: string,
  categoryScope: string,
): MerchantSuggestionQuery {
  return {
    queryKey: ['merchant-suggestion', categoryScope, merchant.trim().toLowerCase()] as const,
    queryFn: async (): Promise<MerchantSuggestion> => {
      const response = await fetch('/api/merchant-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: merchant.trim() }),
      });
      if (!response.ok) {
        const consentError = await aiConsentErrorFromResponse(response);
        throw consentError ?? new Error('Merchant suggestion failed');
      }
      return (await response.json()) as MerchantSuggestion;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  };
}

export function useMerchantSuggestion(
  merchant: string | undefined,
  enabled: boolean,
  categoryScope = '',
): ReturnType<typeof useQuery<MerchantSuggestion>> {
  return useQuery({
    ...merchantSuggestionQuery(merchant ?? '', categoryScope),
    enabled: enabled && !!merchant?.trim() && !!categoryScope,
  });
}
