export type OnboardingPhase = 'account' | 'categories' | 'expense' | 'complete';
export const ONBOARDING_EVENT = 'anotto:onboarding-completed';
export function onboardingPhase(
  preferences: Record<string, unknown>,
  hasHistory: boolean,
): OnboardingPhase {
  const phase = preferences.onboarding_phase;
  if (['account', 'categories', 'expense', 'complete'].includes(String(phase)))
    return phase as OnboardingPhase;
  return preferences.onboarding_dismissed === true || hasHistory ? 'complete' : 'account';
}
export function nextOnboardingPhase(phase: OnboardingPhase, completed: string): OnboardingPhase {
  if (phase !== completed) return phase;
  return (
    {
      account: 'categories',
      categories: 'expense',
      expense: 'complete',
      complete: 'complete',
    } as const
  )[phase];
}
export function completeOnboardingStep(step: 'account' | 'categories' | 'expense'): void {
  window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT, { detail: step }));
}
