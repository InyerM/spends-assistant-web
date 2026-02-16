'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UsageData } from '@/types';

interface UsageIndicatorProps {
  usage: UsageData;
  showTransactions?: boolean;
  className?: string;
}

function getUsageColor(percentage: number): string {
  if (percentage >= 80) return 'text-destructive';
  if (percentage >= 50) return 'text-warning';
  return 'text-muted-foreground';
}

export function UsageIndicator({
  usage,
  showTransactions = false,
  className,
}: UsageIndicatorProps): React.ReactElement {
  const aiPercentage = Math.round((usage.ai_parses_used / usage.ai_parses_limit) * 100);
  const aiColor = getUsageColor(aiPercentage);

  return (
    <div
      className={cn(
        'border-border bg-muted/30 flex items-center justify-between rounded-lg border px-3 py-2 text-xs',
        className,
      )}>
      <span className='flex items-center gap-1.5'>
        <Sparkles className='h-3 w-3 text-purple-400' />
        <span className={aiColor}>
          AI Parses: {usage.ai_parses_used}/{usage.ai_parses_limit}
        </span>
        {showTransactions && (
          <span className='text-muted-foreground'>
            {' '}
            · Transactions: {usage.transactions_count}/{usage.transactions_limit}
          </span>
        )}
      </span>
      {aiPercentage >= 80 && (
        <a href='/settings?tab=subscription' className='text-primary font-medium hover:underline'>
          Upgrade
        </a>
      )}
    </div>
  );
}
