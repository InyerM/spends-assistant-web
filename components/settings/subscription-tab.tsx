'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubscription } from '@/hooks/use-subscription';
import { useUsage } from '@/hooks/use-usage';
import { Check, Sparkles } from 'lucide-react';

const proFeatures = [
  'Unlimited AI parses',
  'Unlimited transactions',
  'Unlimited accounts',
  'Unlimited automation rules',
  'Unlimited categories',
  'Data export (CSV, PDF)',
  'Advanced analytics',
  'Priority support',
];

export function SubscriptionTab(): React.ReactElement {
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

  const aiPercent = aiLimit > 0 ? Math.round((aiUsed / aiLimit) * 100) : 0;
  const txPercent = txLimit > 0 ? Math.round((txCount / txLimit) * 100) : 0;

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <CardTitle>Current plan</CardTitle>
            <Badge variant={plan === 'pro' ? 'default' : 'secondary'}>
              {plan === 'pro' ? 'Pro' : 'Free'}
            </Badge>
          </div>
          <CardDescription>
            {plan === 'free'
              ? 'You are on the free plan with limited usage'
              : 'You have access to all Pro features'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {plan === 'free' ? (
            <div className='space-y-4'>
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>AI Parses</span>
                  <span className='font-medium'>
                    {aiUsed}/{aiLimit} this month
                  </span>
                </div>
                <Progress value={aiPercent} />
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Transactions</span>
                  <span className='font-medium'>
                    {txCount}/{txLimit} this month
                  </span>
                </div>
                <Progress value={txPercent} />
              </div>
            </div>
          ) : (
            <div className='space-y-3'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Status</span>
                <Badge variant='default'>
                  {subscription?.status === 'active'
                    ? 'Active'
                    : subscription?.status === 'canceled'
                      ? 'Canceled'
                      : 'Past due'}
                </Badge>
              </div>
              {subscription?.current_period_start && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Current period</span>
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
                      : 'Ongoing'}
                  </span>
                </div>
              )}
              <div className='border-border border-t pt-3'>
                <p className='text-muted-foreground mb-2 text-xs font-medium'>
                  Included in your plan
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
              <CardTitle>Pro Plan</CardTitle>
            </div>
            <CardDescription>Unlock unlimited usage and advanced features</CardDescription>
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
                      Upgrade to Pro
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Coming Soon</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
