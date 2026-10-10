import { expect, it } from 'vitest';
import { onboardingPhase, nextOnboardingPhase } from '@/lib/onboarding-flow';
it('keeps the guide alive after an account is created and completes only after a confirmed expense', () => {
  expect(onboardingPhase({}, false)).toBe('account');
  expect(onboardingPhase({ onboarding_phase: 'categories' }, true)).toBe('categories');
  expect(nextOnboardingPhase('account', 'account')).toBe('categories');
  expect(nextOnboardingPhase('categories', 'expense')).toBe('categories');
  expect(nextOnboardingPhase('expense', 'expense')).toBe('complete');
  expect(onboardingPhase({}, true)).toBe('complete');
  expect(onboardingPhase({ onboarding_phase: 'account', onboarding_dismissed: false }, true)).toBe(
    'account',
  );
});
