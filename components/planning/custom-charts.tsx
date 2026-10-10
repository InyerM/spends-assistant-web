'use client';
import { useLocale, useTranslations } from 'next-intl';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useAllCategories } from '@/lib/api/queries/category.queries';
import { useAllChartAccounts } from '@/lib/api/queries/account.queries';
import { customCharts, chartTotals } from '@/lib/custom-charts';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';
import type { Transaction } from '@/types';
export function CustomCharts({
  transactions,
  partial,
}: {
  transactions: Transaction[];
  partial: boolean;
}): React.ReactElement {
  const t = useTranslations('customCharts'),
    locale = useLocale() as Locale;
  const { data } = usePlanning(),
    { data: accounts } = useAllChartAccounts(),
    { data: categories } = useAllCategories();
  return (
    <div className='space-y-4'>
      {customCharts(data?.preferences.dashboard_custom_charts).map((config) => {
        const rows = chartTotals(
          config,
          transactions.map((tx) => ({
            type: tx.type,
            amount: tx.amount,
            currency: accounts?.find((a) => a.id === tx.account_id)?.currency ?? '',
            account: tx.account_id,
            category: tx.category_id ?? '',
          })),
        );
        const maximum = rows[0]?.amount ?? 1;
        const format = (amount: number): string =>
          new Intl.NumberFormat(locale, { style: 'currency', currency: config.currency }).format(
            amount,
          );
        return (
          <article className='border-border bg-card rounded-xl border p-5' key={config.id}>
            <h2 className='font-semibold break-words'>{config.name}</h2>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('period')} · {config.currency}
            </p>
            {partial && (
              <p className='text-warning mt-2 text-sm' role='status'>
                {t('partial')}
              </p>
            )}
            {!rows.length && <p className='text-muted-foreground mt-4 text-sm'>{t('empty')}</p>}
            <ul className='mt-4 space-y-3'>
              {rows.map((row) => {
                const category = categories?.find((c) => c.id === row.id);
                const label =
                  config.group === 'account'
                    ? (accounts?.find((a) => a.id === row.id)?.name ?? t('unknownAccount'))
                    : category
                      ? getCategoryName(category, locale)
                      : t('uncategorized');
                return (
                  <li key={row.id}>
                    <div className='flex items-start justify-between gap-3 text-sm'>
                      <span className='min-w-0 break-words'>{label}</span>
                      <span className='shrink-0 tabular-nums'>{format(row.amount)}</span>
                    </div>
                    <div
                      aria-hidden
                      className='bg-primary/15 mt-1 h-2 overflow-hidden rounded-full'>
                      <div
                        className='bg-primary h-full rounded-full'
                        style={{ width: `${maximum ? (row.amount / maximum) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
