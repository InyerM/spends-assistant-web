'use client';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useMonthlyBudgets } from '@/lib/api/queries/budget.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';
import { formatCurrency } from '@/lib/utils/formatting';
export function MoneyAlerts(): React.ReactElement | null {
  const t = useTranslations('dashboardWidgets');
  const locale = useLocale();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { data: planning } = usePlanning();
  const goals = (planning?.goals ?? []).filter(
    (goal) => goal.saved_amount / goal.target_amount >= 0.8,
  );
  const { data: categories } = useCategories();
  const { data } = useMonthlyBudgets(month);
  const alerts = (data ?? []).filter((budget) => budget.threshold !== 'none');
  if (!alerts.length && !goals.length) return null;
  return (
    <section className='border-warning/25 bg-warning/5 rounded-xl border p-4'>
      <h2 className='mb-2 flex items-center gap-2 text-sm font-semibold'>
        <AlertTriangle className='text-warning size-4' aria-hidden='true' />
        {t('alerts')}
      </h2>
      <ul className='space-y-1'>
        {alerts.slice(0, 3).map((budget) => (
          <li key={budget.budget_id}>
            <Link
              href='/budgets'
              className='hover:bg-warning/10 focus-visible:ring-ring block rounded-md p-2 text-sm focus-visible:ring-2'>
              {categories?.find((category) => category.id === budget.category_id)
                ? getCategoryName(
                    categories.find((category) => category.id === budget.category_id)!,
                    locale as Locale,
                  )
                : t('budgets')}{' '}
              —{' '}
              {t(budget.threshold === '100' ? 'overBudget' : 'nearBudget', {
                spent: formatCurrency(Number(budget.spent_cop), 'COP', locale),
                limit: formatCurrency(Number(budget.limit_cop), 'COP', locale),
              })}
            </Link>
          </li>
        ))}
        {goals.slice(0, 2).map((goal) => (
          <li key={goal.id}>
            <Link
              href='/planning'
              className='hover:bg-warning/10 focus-visible:ring-ring block rounded-md p-2 text-sm focus-visible:ring-2'>
              {t(goal.saved_amount >= goal.target_amount ? 'goalReached' : 'goalNear', {
                name: goal.name,
                progress: Math.round((goal.saved_amount / goal.target_amount) * 100),
              })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
