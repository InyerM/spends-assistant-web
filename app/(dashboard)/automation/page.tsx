'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { AutomationForm } from '@/components/automation/automation-form';
import { useAutomationRules } from '@/lib/api/queries/automation.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import {
  useToggleAutomationRule,
  useDeleteAutomationRule,
} from '@/lib/api/mutations/automation.mutations';
import { Plus, Pencil, Trash2, Zap } from 'lucide-react';
import type { AutomationRule } from '@/types';

export default function AutomationPage(): React.ReactElement {
  const { data: rules, isLoading } = useAutomationRules();
  const { data: accounts } = useAccounts();
  const toggleMutation = useToggleAutomationRule();
  const deleteMutation = useDeleteAutomationRule();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  const getAccountName = (accountId: string | null): string | null => {
    if (!accountId || !accounts) return null;
    return accounts.find((a) => a.id === accountId)?.name ?? null;
  };

  const handleToggle = (rule: AutomationRule, checked: boolean): void => {
    toggleMutation.mutate(
      { id: rule.id, is_active: checked },
      {
        onError: () => {
          toast.error('Failed to toggle rule');
        },
      },
    );
  };

  const handleEdit = (rule: AutomationRule): void => {
    setEditingRule(rule);
    setFormOpen(true);
  };

  const handleCreate = (): void => {
    setEditingRule(null);
    setFormOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Rule deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='flex items-center justify-between'>
        <div className='min-w-0'>
          <h2 className='text-foreground text-xl font-bold sm:text-2xl'>Automation Rules</h2>
          <p className='text-muted-foreground hidden text-sm sm:block'>
            Rules that automatically categorize and process transactions
          </p>
        </div>
        <Button className='cursor-pointer' onClick={handleCreate}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>New Rule</span>
        </Button>
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
                <CardHeader className='flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:gap-4'>
                  <div className='min-w-0 flex-1'>
                    <CardTitle className='text-base font-medium'>{rule.name}</CardTitle>
                    <div className='mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2'>
                      <Badge variant='outline'>Priority: {rule.priority}</Badge>
                      {rule.match_phone && (
                        <Badge variant='secondary'>
                          <span className='hidden sm:inline'>Phone: </span>
                          {rule.match_phone}
                        </Badge>
                      )}
                      {transferAccount && (
                        <Badge variant='secondary'>
                          <span className='hidden sm:inline'>Transfer to: </span>
                          {transferAccount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(): void => handleEdit(rule)}
                      className='h-9 w-9 cursor-pointer p-0 sm:h-8 sm:w-8'>
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(): void => setDeleteTarget(rule)}
                      className='text-destructive h-9 w-9 cursor-pointer p-0 sm:h-8 sm:w-8'>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked): void => handleToggle(rule, checked)}
                    />
                  </div>
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
                        {rule.conditions.raw_text_contains?.map((term) => (
                          <Badge key={term} variant='outline' className='text-xs'>
                            raw text: &quot;{term}&quot;
                          </Badge>
                        ))}
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
                        {rule.actions.set_account && (
                          <Badge variant='default' className='text-xs'>
                            set account: {getAccountName(rule.actions.set_account) ?? 'unknown'}
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
                      <p className='text-muted-foreground line-clamp-2 text-xs'>
                        {rule.prompt_text}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AutomationForm open={formOpen} onOpenChange={setFormOpen} rule={editingRule} />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open): void => {
          if (!open) setDeleteTarget(null);
        }}
        title='Delete Rule'
        description={
          <p className='text-muted-foreground text-sm'>
            This will permanently delete this automation rule.
          </p>
        }
        confirmText={deleteTarget?.name ?? ''}
        onConfirm={(): void => void handleDeleteConfirm()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
