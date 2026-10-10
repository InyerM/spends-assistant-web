import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useAutomaticOnboarding } from '@/hooks/use-automatic-onboarding';
import { completeOnboardingStep } from '@/lib/onboarding-flow';
const mocks = vi.hoisted(() => ({
  drive: vi.fn(),
  destroy: vi.fn(),
  factory: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock('driver.js', () => ({
  driver: (config: unknown) => {
    mocks.factory(config);
    return { drive: mocks.drive, destroy: mocks.destroy };
  },
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/api/queries/planning.queries', () => ({
  usePlanning: () => ({ data: { preferences: { onboarding_phase: 'account' } } }),
}));
vi.mock('@/lib/api/queries/transaction.queries', () => ({
  useTransactions: () => ({ data: { count: 100 } }),
}));
vi.mock('@/lib/api/mutations/planning.mutations', () => ({
  useSavePlanning: () => ({ mutate: mocks.mutate }),
}));
it('starts automatically for an explicitly reset owner and advances only when account creation succeeds', async () => {
  const element = document.createElement('button');
  element.dataset.guide = 'account';
  document.body.append(element);
  vi.spyOn(element, 'getClientRects').mockReturnValue([{ width: 100 }] as unknown as DOMRectList);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true }),
  });
  const hook = renderHook(() => useAutomaticOnboarding());
  await waitFor(() => expect(mocks.drive).toHaveBeenCalledOnce());
  expect(mocks.mutate).not.toHaveBeenCalled();
  act(() => completeOnboardingStep('account'));
  expect(mocks.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: {
        action: 'preferences',
        preferences: { onboarding_phase: 'categories', onboarding_dismissed: false },
      },
    }),
  );
  hook.unmount();
  element.remove();
  expect(mocks.destroy).toHaveBeenCalled();
});
