'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubscription } from '@/hooks/use-subscription';
import { useUsage } from '@/hooks/use-usage';
import { Check, Sparkles } from 'lucide-react';

export function SubscriptionTab(): React.ReactElement {
  const t = useTranslations('settings');
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: usage, isLoading: usageLoading } = useUsage();

  const isLoading = subLoading || usageLoading;

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <Skeleton className='h-5 w-32' />
          </CardHeader>
          <CardContent className='space-y-4'>
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = subscription?.plan ?? 'free';
  const aiUsed = usage?.ai_parses_used ?? 0;
  const aiLimit = usage?.ai_parses_limit ?? 15;
  const txCount = usage?.transactions_count ?? 0;
  const txLimit = usage?.transactions_limit ?? 50;
  const accountsCount = usage?.accounts_count ?? 0;
  const accountsLimit = usage?.accounts_limit ?? 4;
  const categoriesCount = usage?.categories_count ?? 0;
  const categoriesLimit = usage?.categories_limit ?? 10;
  const automationsCount = usage?.automations_count ?? 0;
  const automationsLimit = usage?.automations_limit ?? 10;

  const aiPercent = aiLimit > 0 ? Math.round((aiUsed / aiLimit) * 100) : 0;
  const txPercent = txLimit > 0 ? Math.round((txCount / txLimit) * 100) : 0;
  const accountsPercent = accountsLimit > 0 ? Math.round((accountsCount / accountsLimit) * 100) : 0;
  const categoriesPercent =
    categoriesLimit > 0 ? Math.round((categoriesCount / categoriesLimit) * 100) : 0;
  const automationsPercent =
    automationsLimit > 0 ? Math.round((automationsCount / automationsLimit) * 100) : 0;

  const proFeatures = [
    t('unlimitedAiParses'),
    t('unlimitedTransactions'),
    t('unlimitedAccounts'),
    t('unlimitedAutomationRules'),
    t('unlimitedCategories'),
    t('dataExport'),
    t('advancedAnalytics'),
    t('prioritySupport'),
  ];

  const usageBars = [
    {
      label: t('aiParses'),
      used: aiUsed,
      limit: aiLimit,
      percent: aiPercent,
      suffix: t('thisMonth', { used: aiUsed, limit: aiLimit }),
    },
    {
      label: t('transactions'),
      used: txCount,
      limit: txLimit,
      percent: txPercent,
      suffix: t('thisMonth', { used: txCount, limit: txLimit }),
    },
    {
      label: t('accounts'),
      used: accountsCount,
      limit: accountsLimit,
      percent: accountsPercent,
      suffix: t('total', { count: accountsCount, limit: accountsLimit }),
    },
    {
      label: t('categories'),
      used: categoriesCount,
      limit: categoriesLimit,
      percent: categoriesPercent,
      suffix: t('total', { count: categoriesCount, limit: categoriesLimit }),
    },
    {
      label: t('automationRules'),
      used: automationsCount,
      limit: automationsLimit,
      percent: automationsPercent,
      suffix: t('total', { count: automationsCount, limit: automationsLimit }),
    },
  ];

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <CardTitle>{t('currentPlan')}</CardTitle>
            <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
              {plan === 'pro' ? t('pro') : t('free')}
            </Badge>
          </div>
          <CardDescription>
            {plan === 'free' ? t('freePlanDescription') : t('proPlanDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {plan === 'free' ? (
            <div className='space-y-4'>
              {usageBars.map((bar) => (
                <div key={bar.label} className='space-y-2'>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-muted-foreground'>{bar.label}</span>
                    <span className='font-medium'>{bar.suffix}</span>
                  </div>
                  <Progress value={Math.min(bar.percent, 100)} />
                </div>
              ))}
            </div>
          ) : (
            <div className='space-y-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>{t('status')}</span>
                <Badge variant='default'>
                  {subscription?.status === 'active'
                    ? t('active')
                    : subscription?.status === 'canceled'
                      ? t('canceled')
                      : t('pastDue')}
                </Badge>
              </div>
              {subscription?.current_period_start && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>{t('currentPeriod')}</span>
                  <span className='font-medium'>
                    {new Date(subscription.current_period_start).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' — '}
                    {subscription.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : t('ongoing')}
                  </span>
                </div>
              )}
              <div className='border-border border-t pt-3'>
                <p className='text-muted-foreground mb-2 text-xs font-medium'>
                  {t('includedInPlan')}
                </p>
                <ul className='space-y-1.5'>
                  {proFeatures.map((feature) => (
                    <li key={feature} className='flex items-center gap-2 text-sm'>
                      <Check className='text-primary h-3.5 w-3.5 shrink-0' />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {plan === 'free' && (
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <Sparkles className='text-primary h-5 w-5' />
              <CardTitle>{t('proPlan')}</CardTitle>
            </div>
            <CardDescription>{t('unlockDescription')}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <ul className='space-y-2'>
              {proFeatures.map((feature) => (
                <li key={feature} className='flex items-center gap-2 text-sm'>
                  <Check className='text-primary h-4 w-4 shrink-0' />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className='inline-block'>
                    <Button disabled className='w-full'>
                      {t('upgradeToPro')}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('comingSoon')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
