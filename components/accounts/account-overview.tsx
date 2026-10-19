'use client';
import { useTranslations, useLocale } from 'next-intl';
import { useAccountActivity } from '@/lib/api/queries/account-activity.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { Skeleton } from '@/components/ui/skeleton';
import type { Account } from '@/types';
export function AccountOverview({ account }: { account: Account }): React.ReactElement {
  const t = useTranslations('accounts'),
    locale = useLocale();
  const query = useAccountActivity(account.id);
  const data = query.data;
  if (query.isPending) return <Skeleton className='h-64 w-full' />;
  if (!data)
    return (
      <p role='status' className='text-muted-foreground text-sm'>
        {t('activityUnavailable')}
      </p>
    );
  const max = Math.max(1, ...data.months.flatMap((m) => [m.income, m.expenses]));
  const top = data.categories[0]?.amount ?? 1;
  return (
    <section className='space-y-5'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h3 className='font-semibold'>{t('activityTitle')}</h3>
        <p className='text-muted-foreground text-xs'>
          {data.period_start} – {data.period_end}
        </p>
      </div>
      <dl className='divide-border border-border grid gap-y-4 rounded-xl border p-4 sm:grid-cols-3 sm:divide-x'>
        {[
          {
            key: 'activityIncome',
            value: formatCurrency(data.income, account.currency, locale),
            color: 'text-success',
          },
          {
            key: 'activityExpenses',
            value: formatCurrency(data.expenses, account.currency, locale),
            color: 'text-warning',
          },
          { key: 'activityCount', value: String(data.count), color: 'text-foreground' },
        ].map((item) => (
          <div key={item.key} className='min-w-0 sm:px-4'>
            <dt className='text-muted-foreground text-xs'>{t(item.key)}</dt>
            <dd className={`mt-1 text-lg font-semibold wrap-anywhere tabular-nums ${item.color}`}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className='grid items-start gap-5 lg:grid-cols-2'>
        <figure className='border-border rounded-xl border p-4'>
          <figcaption className='text-sm font-medium'>{t('monthlyActivity')}</figcaption>
          <div
            className='mt-5 flex h-36 items-stretch justify-around gap-3'
            role='img'
            aria-label={t('monthlyActivity')}>
            {data.months.map((month) => (
              <div
                key={month.month}
                className='flex min-w-0 flex-1 flex-col items-center justify-end gap-2'>
                <div className='flex h-28 w-full items-end justify-center gap-1'>
                  <div
                    title={`${t('activityIncome')}: ${formatCurrency(month.income, account.currency, locale)}`}
                    className='bg-success w-3 rounded-t-sm'
                    style={{ height: `${(month.income / max) * 100}%` }}
                  />
                  <div
                    title={`${t('activityExpenses')}: ${formatCurrency(month.expenses, account.currency, locale)}`}
                    className='bg-warning w-3 rounded-t-sm'
                    style={{ height: `${(month.expenses / max) * 100}%` }}
                  />
                </div>
                <span className='text-muted-foreground text-[11px]'>{month.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className='text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs'>
            <span className='flex items-center gap-1.5'>
              <span className='bg-success size-2 rounded-sm' />
              {t('activityIncome')}
            </span>
            <span className='flex items-center gap-1.5'>
              <span className='bg-warning size-2 rounded-sm' />
              {t('activityExpenses')}
            </span>
          </div>
          <details className='text-muted-foreground mt-3 text-xs'>
            <summary className='cursor-pointer'>{t('showChartData')}</summary>
            <table className='mt-2 w-full text-left'>
              <thead>
                <tr>
                  <th>{t('month')}</th>
                  <th>{t('activityIncome')}</th>
                  <th>{t('activityExpenses')}</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>{formatCurrency(m.income, account.currency, locale)}</td>
                    <td>{formatCurrency(m.expenses, account.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </figure>
        <section className='border-border space-y-4 rounded-xl border p-4'>
          <h4 className='text-sm font-medium'>{t('topCategories')}</h4>
          {data.categories.length === 0 ? (
            <p className='text-muted-foreground text-sm'>{t('noExpenses')}</p>
          ) : (
            data.categories.map((c) => (
              <div key={c.category_id ?? 'none'}>
                <div className='mb-1.5 flex flex-wrap justify-between gap-2 text-xs'>
                  <span>{c.translations?.[locale] ?? c.name ?? t('uncategorized')}</span>
                  <span className='tabular-nums'>
                    {formatCurrency(c.amount, account.currency, locale)}
                  </span>
                </div>
                <div className='bg-muted h-1.5 overflow-hidden rounded-full'>
                  <div
                    className='bg-success h-full rounded-full'
                    style={{ width: `${(c.amount / top) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </section>
      </div>
      <p className='text-muted-foreground text-xs'>
        {t('activityHint', { currency: account.currency })}
      </p>
    </section>
  );
}
