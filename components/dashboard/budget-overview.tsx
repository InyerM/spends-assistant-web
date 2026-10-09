'use client';

import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useMonthlyBudgets } from '@/lib/api/queries/budget.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { budgetProgress } from '@/lib/budgets';
import { formatCurrency } from '@/lib/utils/formatting';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';

interface BudgetOverviewProps {
  month: string;
}

export function BudgetOverview({ month }: BudgetOverviewProps): React.ReactElement | null {
  const t = useTranslations('dashboard');
  const tBudget = useTranslations('budgets');
  const locale = useLocale();
  const { data: budgets, isError } = useMonthlyBudgets(month);
  const { data: categories } = useCategories();

  if (isError || !budgets?.length) return null;

  const categoryMap = new Map((categories ?? []).map((category) => [category.id, category]));
  const coverageIncomplete = budgets.some(
    (budget) => budget.pending_count + budget.unknown_currency_count + budget.excluded_count > 0,
  );
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(`${month}T12:00:00`),
  );

  return (
    <Card className='border-border bg-card min-w-0'>
      <CardContent className='space-y-5 p-5 sm:p-6'>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0 space-y-1'>
            <h2 className='text-base font-semibold'>{t('budgetOverview')}</h2>
            <p className='text-muted-foreground text-sm'>{monthLabel}</p>
          </div>
          <Target className='text-brand h-5 w-5 shrink-0' aria-hidden='true' />
        </div>
        <ul className='divide-border divide-y'>
          {budgets.slice(0, 3).map((budget) => {
            const category = categoryMap.get(budget.category_id);
            const name = category
              ? getCategoryName(category, locale as Locale)
              : tBudget('unknownCategory');
            return (
              <li key={budget.budget_id} className='space-y-2 py-3 first:pt-0'>
                <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
                  <span className='min-w-0 font-medium break-words'>{name}</span>
                  {budget.threshold !== 'none' && (
                    <span className='text-warning text-xs'>
                      {tBudget(budget.threshold === '100' ? 'alert100' : 'alert80')}
                    </span>
                  )}
                </div>
                <p className='text-muted-foreground text-sm tabular-nums'>
                  {t('budgetSpentOf', {
                    spent: formatCurrency(Number(budget.spent_cop), 'COP', locale),
                    limit: formatCurrency(Number(budget.limit_cop), 'COP', locale),
                  })}
                </p>
                <Progress
                  value={budgetProgress(Number(budget.spent_cop), Number(budget.limit_cop))}
                  aria-label={`${name}: ${tBudget('progress')}`}
                />
              </li>
            );
          })}
        </ul>
        {coverageIncomplete && (
          <p className='text-muted-foreground text-xs leading-5'>{t('budgetCoverage')}</p>
        )}
        <Button asChild variant='outline' className='min-h-11 w-full gap-2'>
          <Link href='/budgets'>
            {t('viewBudgets')}
            <ArrowRight className='h-4 w-4' aria-hidden='true' />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
