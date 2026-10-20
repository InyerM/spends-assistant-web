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
  const hasTransfers = (data.transfers_in ?? 0) > 0 || (data.transfers_out ?? 0) > 0;
  const incomingLabel = account.type === 'credit_card' ? 'paymentsReceived' : 'transfersReceived';
  const series = [
    { key: 'income', label: 'activityIncome', color: 'bg-success' },
    { key: 'expenses', label: 'activityExpenses', color: 'bg-warning' },
    ...(hasTransfers
      ? [
          { key: 'transfers_in', label: incomingLabel, color: 'bg-transfer' },
          { key: 'transfers_out', label: 'transfersSent', color: 'bg-muted-foreground' },
        ]
      : []),
  ] as Array<{
    key: 'income' | 'expenses' | 'transfers_in' | 'transfers_out';
    label: string;
    color: string;
  }>;
  const max = Math.max(
    1,
    ...data.months.flatMap((month) => series.map(({ key }) => month[key] ?? 0)),
  );
  const top = data.categories[0]?.amount ?? 1;
  return (
    <section className='space-y-5'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h3 className='font-semibold'>{t('activityTitle')}</h3>
        <p className='text-muted-foreground text-xs'>
          {data.period_start} – {data.period_end}
        </p>
      </div>
      <dl
        className={`divide-border border-border grid grid-cols-2 gap-y-4 rounded-xl border p-4 sm:grid-cols-3 sm:divide-x ${hasTransfers ? 'xl:grid-cols-5' : ''}`}>
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
          ...(hasTransfers
            ? [
                {
                  key: incomingLabel,
                  value: formatCurrency(data.transfers_in ?? 0, account.currency, locale),
                  color: 'text-transfer',
                },
                {
                  key: 'transfersSent',
                  value: formatCurrency(data.transfers_out ?? 0, account.currency, locale),
                  color: 'text-muted-foreground',
                },
              ]
            : []),
          { key: 'activityCount', value: String(data.count), color: 'text-foreground' },
        ].map((item) => (
          <div
            key={item.key}
            className={`min-w-0 sm:px-4 ${item.key === 'activityCount' ? 'col-span-2 sm:col-span-1' : ''}`}>
            <dt className='text-muted-foreground text-xs'>{t(item.key)}</dt>
            <dd className={`mt-1 text-lg font-semibold wrap-anywhere tabular-nums ${item.color}`}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className='grid items-start gap-5 lg:grid-cols-2'>
        <figure className='border-border min-w-0 rounded-xl border p-4'>
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
                  {series.map(({ key, label, color }) => (
                    <div
                      key={key}
                      data-flow={key}
                      title={`${t(label)}: ${formatCurrency(month[key] ?? 0, account.currency, locale)}`}
                      className={`${color} w-3 rounded-t-sm`}
                      style={{ height: `${((month[key] ?? 0) / max) * 100}%` }}
                    />
                  ))}
                </div>
                <span className='text-muted-foreground text-[11px]'>{month.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className='text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs'>
            {series.map(({ key, label, color }) => (
              <span key={key} className='flex items-center gap-1.5'>
                <span className={`${color} size-2 rounded-sm`} />
                {t(label)}
              </span>
            ))}
          </div>
          <details className='text-muted-foreground mt-3 overflow-x-auto text-xs'>
            <summary className='cursor-pointer'>{t('showChartData')}</summary>
            <table className='mt-2 w-full text-left'>
              <thead>
                <tr>
                  <th>{t('month')}</th>
                  {series.map(({ key, label }) => (
                    <th key={key}>{t(label)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    {series.map(({ key }) => (
                      <td key={key}>{formatCurrency(m[key] ?? 0, account.currency, locale)}</td>
                    ))}
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
        {t(account.type === 'credit_card' ? 'cardTransferHint' : 'activityHint', {
          currency: account.currency,
        })}
      </p>
    </section>
  );
}
