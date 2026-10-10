import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useGuidedOnboarding } from '@/hooks/use-guided-onboarding';
const drive = vi.fn(),
  destroy = vi.fn(),
  factory = vi.fn((config: unknown) => ({ drive, destroy, config }));
vi.mock('driver.js', () => ({ driver: (config: unknown) => factory(config) }));
it('highlights actual setup actions without posting and destroys its overlay on unmount', async () => {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: true }),
    configurable: true,
  });
  const labels = {
    account: 'Account',
    accountHint: 'Create',
    categories: 'Categories',
    categoriesHint: 'Review',
    expense: 'Expense',
    expenseHint: 'Confirm',
    next: 'Next',
    previous: 'Previous',
    done: 'Done',
  };
  const hook = renderHook(() => useGuidedOnboarding(labels));
  await act(async () => hook.result.current.start());
  expect(drive).toHaveBeenCalledOnce();
  expect(factory).toHaveBeenCalledWith(
    expect.objectContaining({
      animate: false,
      steps: expect.arrayContaining([
        expect.objectContaining({ element: '[data-guide="account"]' }),
        expect.objectContaining({ element: '[data-guide="expense"]' }),
      ]),
    }),
  );
  const config = factory.mock.calls[0][0] as { onHighlighted: (element: Element) => void };
  const action = document.createElement('button');
  config.onHighlighted(action);
  action.click();
  expect(destroy).toHaveBeenCalled();
  hook.unmount();
  expect(destroy).toHaveBeenCalled();
});
