import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import {
  AI_CONSENT_VERSION,
  parseAiConsentState,
  type AiConsentScope,
  type AiConsentState,
} from '@/lib/ai-consent';
import { aiConsentKeys } from '@/lib/api/queries/ai-consent.queries';

interface AiConsentChoice {
  scope: AiConsentScope;
  granted: boolean;
}

export async function updateAiConsent(choice: AiConsentChoice): Promise<AiConsentState> {
  const response = await fetch('/api/ai/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...choice, version: AI_CONSENT_VERSION }),
  });
  if (!response.ok) throw new Error('AI consent unavailable');
  const state = parseAiConsentState(await response.json().catch(() => null));
  if (!state) throw new Error('AI consent unavailable');
  return state;
}

export function useUpdateAiConsent(): ReturnType<
  typeof useMutation<AiConsentState, Error, AiConsentChoice>
> {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.supabaseUser?.id);
  return useMutation({
    mutationFn: updateAiConsent,
    onSuccess: (state) => queryClient.setQueryData(aiConsentKeys.state(userId), state),
  });
}
