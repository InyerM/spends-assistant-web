'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories } from '@/lib/api/queries/category.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Transaction } from '@/types';
import type { SpendingNature } from '@/types/category';

const NATURE_COLORS: Record<Exclude<SpendingNature, 'none'>, string> = {
  must: '#ef4444',
  need: '#f59e0b',
  want: '#22c55e',
};

const NATURES: Exclude<SpendingNature, 'none'>[] = ['must', 'need', 'want'];

type FilterTab = 'all' | Exclude<SpendingNature, 'none'>;

interface DayData {
  date: string;
  label: string;
  must: number;
  need: number;
  want: number;
}

interface SpendingNatureCardsProps {
  transactions: Transaction[];
  className?: string;
}

interface TooltipEntry {
  dataKey?: string;
  value?: number;
  color?: string;
}

interface NatureTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  locale: string;
  t: (key: string) => string;
}

function CustomTooltip({
  active,
  payload,
  label,
  locale,
  t,
}: NatureTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  return (
    <div className='bg-popover border-border rounded-lg border p-2 text-xs shadow-md'>
      <p className='text-foreground mb-1 font-medium'>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className='flex items-center gap-1.5'>
          <span className='h-2 w-2 rounded-full' style={{ backgroundColor: entry.color }} />
          <span className='text-muted-foreground'>{t(entry.dataKey ?? '')}:</span>
          <span className='text-foreground font-medium'>
            {formatCurrency(entry.value ?? 0, 'COP', locale)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function SpendingNatureCards({
  transactions,
  className,
}: SpendingNatureCardsProps): React.ReactElement | null {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data: categories, isLoading: catLoading } = useCategories();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const { chartData, total } = useMemo(() => {
    if (!categories) return { chartData: [], total: 0 };

    const categoryNatureMap = new Map<string, SpendingNature>();
    for (const cat of categories) {
      if (cat.spending_nature && cat.spending_nature !== 'none') {
        categoryNatureMap.set(cat.id, cat.spending_nature);
      }
    }

    // Build day map for the entire date range
    const dayMap = new Map<string, { must: number; need: number; want: number }>();

    for (const tx of transactions) {
      if (tx.type !== 'expense') continue;
      const nature = tx.category_id ? categoryNatureMap.get(tx.category_id) : undefined;
      if (!nature || nature === 'none') continue;

      const existing = dayMap.get(tx.date) ?? { must: 0, need: 0, want: 0 };
      existing[nature] += tx.amount;
      dayMap.set(tx.date, existing);
    }

    // Only include days that have data
    const days: DayData[] = [];
    let sum = 0;

    const sortedDates = [...dayMap.keys()].sort();
    for (const key of sortedDates) {
      const vals = dayMap.get(key)!;
      const d = new Date(key + 'T00:00:00');
      const dayNum = d.getDate();
      const month = d.getMonth() + 1;
      days.push({ date: key, label: `${month}/${dayNum}`, ...vals });
      sum += vals.must + vals.need + vals.want;
    }

    return { chartData: days, total: sum };
  }, [transactions, categories]);

  if (catLoading) {
    return (
      <Card className={`border-border bg-card ${className ?? ''}`}>
        <CardContent className='p-4 sm:p-5'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='mt-1 h-3 w-64' />
          <Skeleton className='mt-3 h-8 w-full rounded-full' />
          <Skeleton className='mt-4 h-8 w-36' />
          <Skeleton className='mt-3 h-[200px] w-full rounded-lg' />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) return null;

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: tCommon('all') },
    { key: 'must', label: t('must') },
    { key: 'need', label: t('need') },
    { key: 'want', label: t('want') },
  ];

  const visibleNatures = activeTab === 'all' ? NATURES : [activeTab];
  const filteredTotal =
    activeTab === 'all' ? total : chartData.reduce((sum, d) => sum + d[activeTab], 0);

  return (
    <Card className={`border-border bg-card ${className ?? ''}`}>
      <CardContent className='p-4 sm:p-5'>
        <h3 className='text-foreground text-base font-semibold'>{t('spendingNature')}</h3>
        <p className='text-muted-foreground mt-0.5 text-xs'>{t('spendingNatureSubtitle')}</p>

        <div className='bg-muted mt-3 flex rounded-full p-0.5'>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type='button'
              onClick={(): void => setActiveTab(tab.key)}
              className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <p className='text-foreground mt-4 text-xl font-bold sm:text-2xl'>
          {formatCurrency(filteredTotal, 'COP', locale)}
        </p>

        <div className='mt-3 h-[200px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={chartData} barGap={1} barCategoryGap='20%'>
              <XAxis
                dataKey='label'
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval='preserveStartEnd'
                className='fill-muted-foreground'
              />
              <YAxis
                scale='sqrt'
                domain={[0, 'auto']}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={45}
                className='fill-muted-foreground'
              />
              <Tooltip
                content={
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ((props: any) => <CustomTooltip {...props} locale={locale} t={t} />) as any
                }
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              />
              <Legend
                iconType='square'
                iconSize={10}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(value: string): string => t(value)}
              />
              {visibleNatures.map((nature) => (
                <Bar
                  key={nature}
                  dataKey={nature}
                  fill={NATURE_COLORS[nature]}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
