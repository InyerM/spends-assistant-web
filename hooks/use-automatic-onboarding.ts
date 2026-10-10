'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Driver, DriveStep } from 'driver.js';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import { ONBOARDING_EVENT, onboardingPhase, nextOnboardingPhase } from '@/lib/onboarding-flow';
export function useAutomaticOnboarding(): void {
  const { data } = usePlanning();
  const { data: history } = useTransactions({ type: 'expense', limit: 1 });
  const save = useSavePlanning();
  const pathname = usePathname(),
    router = useRouter(),
    t = useTranslations('onboarding');
  const currentContext = useRef<string | null>(null);
  const active = useRef<Driver | null>(null),
    seen = useRef(new Set<string>());
  const phase =
    data && history ? onboardingPhase(data.preferences, Boolean(history.count)) : 'complete';
  const mutation = useRef(save.mutate);
  useEffect(() => {
    mutation.current = save.mutate;
  }, [save.mutate]);
  useEffect(() => {
    function complete(event: Event): void {
      const step = (event as CustomEvent<string>).detail;
      const next = nextOnboardingPhase(phase, step);
      if (next === phase) return;
      active.current?.destroy();
      mutation.current({
        request_id: crypto.randomUUID(),
        payload: {
          action: 'preferences',
          preferences: { onboarding_phase: next, onboarding_dismissed: next === 'complete' },
        },
      });
    }
    window.addEventListener(ONBOARDING_EVENT, complete);
    return (): void => window.removeEventListener(ONBOARDING_EVENT, complete);
  }, [phase]);
  useEffect(() => {
    if (phase === 'complete') return;
    let cancelled = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function inspect(): Promise<void> {
      const visible = (selector: string): boolean => {
        const element = document.querySelector(selector) as HTMLElement | null;
        return Boolean(element && element.getClientRects().length);
      };
      const context = visible('[data-guide="account-form"]')
        ? 'account-form'
        : visible('[data-guide="category-form"]')
          ? 'category-form'
          : visible('[data-guide="expense-form"]')
            ? 'expense-form'
            : phase === 'expense' && pathname === '/documents'
              ? 'documents-page'
              : phase === 'categories' && pathname === '/categories'
                ? 'categories-page'
                : pathname === '/dashboard'
                  ? 'dashboard'
                  : null;
      if (!context) {
        active.current?.destroy();
        return;
      }
      const key = `${phase}:${context}`;
      if (seen.current.has(key)) {
        if (currentContext.current !== key) {
          active.current?.destroy();
          currentContext.current = key;
        }
        return;
      }
      currentContext.current = key;
      seen.current.add(key);
      const step = (element: string, title: string, description: string): DriveStep => ({
        element,
        popover: { title, description },
      });
      const steps: DriveStep[] =
        context === 'account-form'
          ? [
              step('[data-guide="account-name"]', t('account'), t('accountNameHint')),
              step('[data-guide="account-form"]', t('accountDetails'), t('accountDetailsHint')),
            ]
          : context === 'category-form'
            ? [step('[data-guide="category-form"]', t('categories'), t('categoryFormHint'))]
            : context === 'expense-form'
              ? [step('[data-guide="expense-form"]', t('expense'), t('expenseFormHint'))]
              : context === 'documents-page'
                ? [step('[data-guide="documents-page"]', t('expense'), t('receiptGuideHint'))]
                : context === 'categories-page'
                  ? [
                      step(
                        '[data-guide="categories-page"]',
                        t('categories'),
                        t('categoriesPageHint'),
                      ),
                    ]
                  : [step(`[data-guide="${phase}"]`, t(phase), t(`${phase}Hint`))];
      const { driver } = await import('driver.js');
      if (cancelled) return;
      active.current?.destroy();
      active.current = driver({
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        popoverClass: 'anotto-tour',
        allowClose: true,
        disableActiveInteraction: false,
        showProgress: true,
        nextBtnText: t('next'),
        prevBtnText: t('previous'),
        doneBtnText: t(context === 'categories-page' ? 'continueExpense' : 'done'),
        steps,
        onNextClick: (_element, _step, options) => {
          if (context === 'categories-page') {
            window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT, { detail: 'categories' }));
            router.push('/dashboard');
          } else if (options.driver.hasNextStep()) options.driver.moveNext();
          else options.driver.destroy();
        },
      });
      active.current.drive();
    }
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void inspect(), 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    void inspect();
    return (): void => {
      cancelled = true;
      observer.disconnect();
      if (timer) clearTimeout(timer);
      active.current?.destroy();
    };
  }, [phase, pathname, router, t]);
}
