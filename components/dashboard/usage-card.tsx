'use client';

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

export function UsageCard(): React.ReactElement | null {
  const { data: usage, isLoading: usageLoading } = useUsage();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  if (subscription?.plan === 'pro') return null;

  if (usageLoading || subLoading) {
    return <Skeleton className='h-[100px] w-full rounded-xl' />;
  }

  if (!usage) return null;

  const aiPercentage = Math.min(
    Math.round((usage.ai_parses_used / usage.ai_parses_limit) * 100),
    100,
  );
  const txPercentage = Math.min(
    Math.round((usage.transactions_count / usage.transactions_limit) * 100),
    100,
  );
  const limitReached =
    usage.ai_parses_used >= usage.ai_parses_limit ||
    usage.transactions_count >= usage.transactions_limit;

  return (
    <Card className='border-border bg-card'>
      <CardContent className='space-y-3 p-3 sm:p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='bg-card-overlay flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10'>
              <Sparkles className='h-4 w-4 text-purple-400 sm:h-5 sm:w-5' />
            </div>
            <p className='text-sm font-semibold'>AI Usage</p>
          </div>
          {limitReached && (
            <a
              href='/settings?tab=subscription'
              className='text-primary text-xs font-medium hover:underline'>
              Upgrade &rarr;
            </a>
          )}
        </div>

        <div className='space-y-2'>
          <div>
            <div className='mb-1 flex items-center justify-between text-xs'>
              <span className='text-muted-foreground'>AI Parses</span>
              <span className={cn('font-medium', getTextColor(aiPercentage))}>
                {usage.ai_parses_used}/{usage.ai_parses_limit}
              </span>
            </div>
            <div
              className={cn(
                'h-2 w-full overflow-hidden rounded-full',
                getTrackColor(aiPercentage),
              )}>
              <div
                className={cn('h-full rounded-full transition-all', getBarColor(aiPercentage))}
                style={{ width: `${aiPercentage}%` }}
              />
            </div>
            <p className={cn('mt-0.5 text-[10px]', getTextColor(aiPercentage))}>
              {aiPercentage}% used this month
            </p>
          </div>

          <div>
            <div className='mb-1 flex items-center justify-between text-xs'>
              <span className='text-muted-foreground'>Transactions</span>
              <span className={cn('font-medium', getTextColor(txPercentage))}>
                {usage.transactions_count}/{usage.transactions_limit}
              </span>
            </div>
            <div
              className={cn(
                'h-2 w-full overflow-hidden rounded-full',
                getTrackColor(txPercentage),
              )}>
              <div
                className={cn('h-full rounded-full transition-all', getBarColor(txPercentage))}
                style={{ width: `${txPercentage}%` }}
              />
            </div>
            <p className={cn('mt-0.5 text-[10px]', getTextColor(txPercentage))}>
              {txPercentage}% used this month
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
