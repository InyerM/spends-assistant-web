'use client';

import { useTranslations } from 'next-intl';
import { MonthSelector } from '@/components/dashboard/month-selector';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface BudgetComparisonFieldsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  month: string;
  currentMonth: string;
  onMonthChange: (month: string) => void;
}

export function BudgetComparisonFields({
  enabled,
  onEnabledChange,
  month,
  currentMonth,
  onMonthChange,
}: BudgetComparisonFieldsProps): React.ReactElement {
  const t = useTranslations('budgets');
  const [year, monthNumber] = month.split('-').map(Number);
  return (
    <>
      <div className='space-y-2'>
        <div className='flex items-center gap-3'>
          <Checkbox
            aria-label={t('comparePreviousMonth')}
            id='budget-compare'
            checked={enabled}
            onCheckedChange={(checked) => onEnabledChange(checked === true)}
          />
          <Label htmlFor='budget-compare'>{t('comparePreviousMonth')}</Label>
        </div>
        <p className='text-muted-foreground text-sm'>{t('comparisonHint')}</p>
      </div>
      {enabled && (
        <div className='space-y-2'>
          <p className='text-sm font-medium'>{t('comparisonMonth')}</p>
          <MonthSelector
            year={year}
            month={monthNumber - 1}
            onChange={(nextYear, selected) =>
              onMonthChange(`${nextYear}-${String(selected + 1).padStart(2, '0')}-01`)
            }
          />
          <p className='text-muted-foreground text-sm'>{t('historicalNotice')}</p>
          {month >= currentMonth && (
            <p role='alert' className='text-destructive text-sm'>
              {t('pastMonthRequired')}
            </p>
          )}
        </div>
      )}
    </>
  );
}
