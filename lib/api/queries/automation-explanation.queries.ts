import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { aiConsentErrorFromResponse } from '@/lib/ai-consent';
import {
  automationExplanationIdentity,
  type AutomationExplanationDraft,
} from '@/lib/utils/automation-explanation';

export interface AutomationExplanation {
  explanation: string;
  fingerprint: string;
  cached: boolean;
}
export function automationExplanationKey(
  owner: string | undefined,
  rule: AutomationExplanationDraft,
  locale: string,
): readonly unknown[] {
  return ['automation-explanation', owner, locale, automationExplanationIdentity(rule)] as const;
}
export async function fetchAutomationExplanation(
  rule: AutomationExplanationDraft,
  locale: string,
): Promise<AutomationExplanation> {
  const response = await fetch('/api/automation-rules/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rule, locale }),
  });
  if (!response.ok) {
    const consent = await aiConsentErrorFromResponse(response);
    if (consent) throw consent;
    throw new Error('Explanation unavailable');
  }
  return response.json() as Promise<AutomationExplanation>;
}
export function useAutomationExplanation(
  rule: AutomationExplanationDraft,
  locale: string,
  enabled: boolean,
): ReturnType<typeof useQuery<AutomationExplanation>> {
  const owner = useAuthStore((state) => state.supabaseUser?.id);
  return useQuery({
    queryKey: automationExplanationKey(owner, rule, locale),
    queryFn: () => fetchAutomationExplanation(rule, locale),
    enabled: !!owner && enabled,
    staleTime: Infinity,
    gcTime: 86400000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
