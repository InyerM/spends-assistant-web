import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { parseAiConsentState, type AiConsentState } from '@/lib/ai-consent';

export const aiConsentKeys = {
  state: (userId?: string | null) => ['ai-consent', userId ?? null] as const,
};

export async function fetchAiConsent(): Promise<AiConsentState> {
  const response = await fetch('/api/ai/consent', { cache: 'no-store' });
  if (!response.ok) throw new Error('AI consent unavailable');
  const state = parseAiConsentState(await response.json().catch(() => null));
  if (!state) throw new Error('AI consent unavailable');
  return state;
}

export function useAiConsent(): ReturnType<typeof useQuery<AiConsentState>> {
  const userId = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({ queryKey: aiConsentKeys.state(userId), queryFn: fetchAiConsent, retry: false });
}
