'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles } from 'lucide-react';
import { useUsage } from '@/hooks/use-usage';
import { useSubscription } from '@/hooks/use-subscription';
import { cn } from '@/lib/utils';

function getBarColor(percentage: number): string {
  if (percentage >= 80) return 'bg-destructive';
  if (percentage >= 50) return 'bg-warning';
  return 'bg-emerald-500';
}

function getTextColor(percentage: number): string {
  if (percentage >= 80) return 'text-destructive';
  if (percentage >= 50) return 'text-warning';
  return 'text-emerald-500';
}

function getTrackColor(percentage: number): string {
  if (percentage >= 80) return 'bg-destructive/20';
  if (percentage >= 50) return 'bg-warning/20';
  return 'bg-emerald-500/20';
}

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  suffix?: string;
}

function UsageBar({ label, used, limit, suffix }: UsageBarProps): React.ReactElement {
  const t = useTranslations('dashboard');
  const percentage = Math.min(Math.round((used / limit) * 100), 100);

  return (
    <div>
      <div className='mb-1 flex items-center justify-between text-xs'>
        <span className='text-muted-foreground'>{label}</span>
        <span className={cn('font-medium', getTextColor(percentage))}>
          {used}/{limit}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <div className={cn('h-2 w-full overflow-hidden rounded-full', getTrackColor(percentage))}>
        <div
          className={cn('h-full rounded-full transition-all', getBarColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className={cn('mt-0.5 text-[10px]', getTextColor(percentage))}>
        {t('usedThisMonth', { percentage })}
      </p>
    </div>
  );
}

export function UsageCard(): React.ReactElement | null {
  const t = useTranslations('dashboard');
  const { data: usage, isLoading: usageLoading } = useUsage();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  if (subscription?.plan === 'pro') return null;

  if (usageLoading || subLoading) {
    return <Skeleton className='h-[100px] w-full rounded-xl' />;
  }

  if (!usage) return null;

  return (
    <Card className='border-border bg-card'>
      <CardContent className='space-y-3 p-3 sm:p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='bg-card-overlay flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10'>
              <Sparkles className='h-4 w-4 text-purple-400 sm:h-5 sm:w-5' />
            </div>
            <p className='text-sm font-semibold'>{t('usage')}</p>
          </div>
          <a
            href='/settings?tab=subscription'
            className='text-primary text-xs font-medium hover:underline'>
            {t('upgradeLink')} &rarr;
          </a>
        </div>

        <div className='space-y-2'>
          <UsageBar
            label={t('aiParses')}
            used={usage.ai_parses_used}
            limit={usage.ai_parses_limit}
          />
          <UsageBar
            label={t('transactions')}
            used={usage.transactions_count}
            limit={usage.transactions_limit}
          />
          <UsageBar
            label={t('accounts')}
            used={usage.accounts_count}
            limit={usage.accounts_limit}
          />
          <UsageBar
            label={t('categories')}
            used={usage.categories_count}
            limit={usage.categories_limit}
          />
          <UsageBar
            label={t('automationRules')}
            used={usage.automations_count}
            limit={usage.automations_limit}
          />
        </div>
      </CardContent>
    </Card>
  );
}
