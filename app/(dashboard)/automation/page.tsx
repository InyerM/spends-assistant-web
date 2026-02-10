'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutomationRules } from '@/lib/api/queries/automation.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { Zap } from 'lucide-react';

export default function AutomationPage(): React.ReactElement {
  const { data: rules, isLoading } = useAutomationRules();
  const { data: accounts } = useAccounts();

  const getAccountName = (accountId: string | null): string | null => {
    if (!accountId || !accounts) return null;
    return accounts.find((a) => a.id === accountId)?.name ?? null;
  };

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h2 className='text-foreground text-2xl font-bold'>Automation Rules</h2>
        <p className='text-muted-foreground text-sm'>
          Rules that automatically categorize and process transactions
        </p>
      </div>

      {isLoading ? (
        <div className='space-y-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-32 w-full' />
          ))}
        </div>
      ) : rules?.length === 0 ? (
        <Card className='border-border bg-card'>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Zap className='text-muted-foreground mb-4 h-12 w-12' />
            <p className='text-muted-foreground'>No automation rules configured</p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {rules?.map((rule) => {
            const transferAccount = getAccountName(rule.transfer_to_account_id);

            return (
              <Card key={rule.id} className='border-border bg-card'>
                <CardHeader className='flex flex-row items-center gap-4 space-y-0'>
                  <div className='flex-1'>
                    <CardTitle className='text-base font-medium'>{rule.name}</CardTitle>
                    <div className='mt-1 flex items-center gap-2'>
                      <Badge variant='outline'>Priority: {rule.priority}</Badge>
                      {rule.match_phone && (
                        <Badge variant='secondary'>Phone: {rule.match_phone}</Badge>
                      )}
                      {transferAccount && (
                        <Badge variant='secondary'>Transfer to: {transferAccount}</Badge>
                      )}
                    </div>
                  </div>
                  <Switch checked={rule.is_active} disabled />
                </CardHeader>
                <CardContent className='space-y-3'>
                  {Object.keys(rule.conditions).length > 0 && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>Conditions</p>
                      <div className='flex flex-wrap gap-1'>
                        {rule.conditions.description_contains?.map((term) => (
                          <Badge key={term} variant='outline' className='text-xs'>
                            contains: &quot;{term}&quot;
                          </Badge>
                        ))}
                        {rule.conditions.description_regex && (
                          <Badge variant='outline' className='text-xs'>
                            regex: {rule.conditions.description_regex}
                          </Badge>
                        )}
                        {rule.conditions.amount_between && (
                          <Badge variant='outline' className='text-xs'>
                            amount: {rule.conditions.amount_between[0]} -{' '}
                            {rule.conditions.amount_between[1]}
                          </Badge>
                        )}
                        {rule.conditions.source?.map((s) => (
                          <Badge key={s} variant='outline' className='text-xs'>
                            source: {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(rule.actions).length > 0 && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>Actions</p>
                      <div className='flex flex-wrap gap-1'>
                        {rule.actions.set_type && (
                          <Badge variant='default' className='text-xs'>
                            set type: {rule.actions.set_type}
                          </Badge>
                        )}
                        {rule.actions.set_category && (
                          <Badge variant='default' className='text-xs'>
                            set category
                          </Badge>
                        )}
                        {rule.actions.auto_reconcile && (
                          <Badge variant='default' className='text-xs'>
                            auto reconcile
                          </Badge>
                        )}
                        {rule.actions.add_note && (
                          <Badge variant='default' className='text-xs'>
                            add note
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {rule.prompt_text && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>AI Prompt</p>
                      <p className='text-muted-foreground text-xs'>{rule.prompt_text}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
