'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { budgetProgress } from '@/lib/budgets';
import { formatCurrency } from '@/lib/utils/formatting';
import { cn } from '@/lib/utils';
import type { BudgetStatus } from '@/lib/api/queries/budget.queries';
import type { Category } from '@/types/category';

interface BudgetCardProps {
  historical?: boolean;
  budget: BudgetStatus;
  category: Category | undefined;
  locale: string;
  onEdit: () => void;
  onDeactivate: () => void;
}

export function BudgetCard({
  budget,
  historical = false,
  category,
  locale,
  onEdit,
  onDeactivate,
}: BudgetCardProps): React.ReactElement {
  const t = useTranslations('budgets');
  const tCommon = useTranslations('common');
  const spent = Number(budget.spent_cop);
  const limit = Number(budget.limit_cop);
  const remaining = limit - spent;
  const progress = budgetProgress(spent, limit);
  const name = category?.translations?.[locale] || category?.name || t('unknownCategory');
  const coverageGaps = budget.pending_count + budget.unknown_currency_count + budget.excluded_count;
  const [showMovements, setShowMovements] = useState(false);
  const movementsId = `budget-movements-${budget.budget_id}`;

  return (
    <Card className='border-border bg-card min-w-0 self-start'>
      <CardContent className='space-y-5 p-5'>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0 space-y-1'>
            <h2 className='truncate text-lg font-semibold'>{name}</h2>
            <p className='text-muted-foreground text-sm'>
              {t(budget.repeat_monthly ? 'repeatMonthly' : 'onlyThisMonth')}
            </p>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <Button variant='ghost' size='icon-sm' onClick={onEdit} aria-label={tCommon('edit')}>
              <Pencil className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              className='text-destructive'
              onClick={onDeactivate}
              aria-label={tCommon('delete')}>
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='flex items-end justify-between gap-3'>
          <div>
            <p className='text-muted-foreground text-xs'>{t('spent')}</p>
            <p className='text-2xl font-semibold tracking-tight'>
              {formatCurrency(spent, 'COP', locale)}
            </p>
          </div>
          <div className='text-right'>
            <p className='text-muted-foreground text-xs'>{t('limit')}</p>
            <p className='text-sm font-medium'>{formatCurrency(limit, 'COP', locale)}</p>
          </div>
        </div>

        <Progress
          value={progress}
          aria-label={t('progress')}
          className={cn(
            budget.threshold !== 'none' &&
              '[&_[data-slot=progress-indicator]]:bg-warning bg-warning/20',
          )}
        />

        <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
          <span className='text-muted-foreground'>
            {remaining >= 0
              ? t('remaining', { amount: formatCurrency(remaining, 'COP', locale) })
              : t('overLimit', { amount: formatCurrency(-remaining, 'COP', locale) })}
          </span>
          {!historical && budget.threshold !== 'none' && (
            <Badge variant='outline' className='border-warning/60 text-warning'>
              {t(budget.threshold === '100' ? 'alert100' : 'alert80')}
            </Badge>
          )}
        </div>

        {coverageGaps > 0 && (
          <p className='text-muted-foreground border-border border-t pt-3 text-xs'>
            {t('coverageWarning', {
              pending: budget.pending_count,
              currency: budget.unknown_currency_count,
              excluded: budget.excluded_count,
            })}
          </p>
        )}

        {budget.contributing_transactions.length > 0 && (
          <div className='border-border border-t pt-3'>
            <Button
              variant='ghost'
              size='sm'
              className='w-full justify-between px-1'
              aria-expanded={showMovements}
              aria-controls={movementsId}
              onClick={(): void => setShowMovements((current) => !current)}>
              {t('viewMovements', { count: budget.contributing_transactions.length })}
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', showMovements && 'rotate-180')}
              />
            </Button>
            {showMovements && (
              <ul id={movementsId} className='mt-2 space-y-1'>
                {budget.contributing_transactions.map((transaction) => (
                  <li key={transaction.id}>
                    <Link
                      href={`/transactions/${transaction.id}`}
                      className='hover:bg-card-overlay focus-visible:ring-ring flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none'>
                      <span className='min-w-0'>
                        <span className='block truncate font-medium'>
                          {transaction.description}
                        </span>
                        <span className='text-muted-foreground text-xs'>{transaction.date}</span>
                      </span>
                      <span className='shrink-0 tabular-nums'>
                        {formatCurrency(transaction.amount, 'COP', locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
