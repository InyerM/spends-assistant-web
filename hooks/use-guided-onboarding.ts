'use client';
import { useEffect, useRef, useState } from 'react';
import type { Driver } from 'driver.js';
export function useGuidedOnboarding(labels: {
  account: string;
  accountHint: string;
  categories: string;
  categoriesHint: string;
  expense: string;
  expenseHint: string;
  next: string;
  previous: string;
  done: string;
}): { start: () => Promise<void>; failed: boolean } {
  const active = useRef<Driver | null>(null);
  const mounted = useRef(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return (): void => {
      mounted.current = false;
      active.current?.destroy();
    };
  }, []);
  async function start(): Promise<void> {
    setFailed(false);
    try {
      const { driver } = await import('driver.js');
      if (!mounted.current) return;
      active.current?.destroy();
      active.current = driver({
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        showProgress: true,
        allowKeyboardControl: true,
        disableActiveInteraction: false,
        popoverClass: 'anotto-tour',
        nextBtnText: labels.next,
        prevBtnText: labels.previous,
        doneBtnText: labels.done,
        steps: [
          {
            element: '[data-guide="account"]',
            popover: { title: labels.account, description: labels.accountHint },
          },
          {
            element: '[data-guide="categories"]',
            popover: { title: labels.categories, description: labels.categoriesHint },
          },
          {
            element: '[data-guide="expense"]',
            popover: { title: labels.expense, description: labels.expenseHint },
          },
        ],
      });
      active.current.drive();
    } catch {
      if (mounted.current) setFailed(true);
    }
  }
  return { start, failed };
}
