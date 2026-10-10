'use client';
import Link from 'next/link';
import { onboardingPhase } from '@/lib/onboarding-flow';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
export function OnboardingCard({
  hasExpense,
  force = false,
  onCreateAccount,
  onCreateExpense,
}: {
  hasExpense: boolean;
  force?: boolean;
  onCreateAccount: () => void;
  onCreateExpense: () => void;
}): React.ReactElement | null {
  const { data: history } = useTransactions({ type: 'expense', limit: 1 });
  const recorded = hasExpense || Boolean(history?.count);
  const t = useTranslations('onboarding');
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data } = usePlanning();
  const save = useSavePlanning();
  if (!data || (!force && onboardingPhase(data.preferences, recorded) === 'complete')) return null;
  const steps = [
    {
      name: t('account'),
      done: Boolean(accounts?.length),
      action: (
        <Button
          data-guide='account'
          variant='outline'
          onClick={() => {
            onCreateAccount();
          }}>
          {t('createAccount')}
        </Button>
      ),
    },
    {
      name: t('categories'),
      done: Boolean(categories?.length),
      action: (
        <Button asChild variant='outline'>
          <Link data-guide='categories' href='/categories'>
            {t('reviewCategories')}
          </Link>
        </Button>
      ),
    },
    {
      name: t('expense'),
      done: recorded,
      action: (
        <div className='flex flex-wrap gap-2'>
          <Button
            data-guide='expense'
            onClick={() => {
              onCreateExpense();
            }}>
            {t('addExpense')}
          </Button>
          <Button asChild variant='outline'>
            <Link href='/documents'>{t('useReceipt')}</Link>
          </Button>
        </div>
      ),
    },
  ];
  return (
    <section className='border-primary/25 bg-primary/5 rounded-xl border p-5'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h2 className='font-semibold'>{t('title')}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>{t('hint')}</p>
        </div>
        <Button
          size='icon'
          variant='ghost'
          aria-label={t('dismiss')}
          onClick={() =>
            save.mutate({
              request_id: crypto.randomUUID(),
              payload: {
                action: 'preferences',
                preferences: { onboarding_dismissed: true, onboarding_phase: 'complete' },
              },
            })
          }>
          <X className='size-4' />
        </Button>
      </div>
      <div className='divide-border mt-4 divide-y'>
        {steps.map((step) => (
          <div key={step.name} className='flex flex-wrap items-center justify-between gap-3 py-3'>
            <span className='flex items-center gap-2'>
              {step.done && <Check className='text-primary size-4' />}
              {step.name}
            </span>
            {step.action}
          </div>
        ))}
      </div>
    </section>
  );
}
