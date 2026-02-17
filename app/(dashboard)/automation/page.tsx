'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { AutomationForm } from '@/components/automation/automation-form';
import { AiAutomationDialog } from '@/components/automation/ai-automation-dialog';
import { SwipeableRow } from '@/components/transactions/swipeable-row';
import { useInfiniteAutomationRules } from '@/lib/api/queries/automation.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import {
  useToggleAutomationRule,
  useDeleteAutomationRule,
  useGenerateAccountRules,
} from '@/lib/api/mutations/automation.mutations';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Zap, Loader2, Wand2, Sparkles, Search, X } from 'lucide-react';
import type { AutomationRule, CreateAutomationRuleInput, RuleType } from '@/types';

type RuleTypeFilter = 'all' | RuleType;
type ActiveFilter = 'all' | 'active' | 'inactive';

const RULE_TYPE_OPTIONS: { value: RuleTypeFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'allTypes' },
  { value: 'general', labelKey: 'general' },
  { value: 'account_detection', labelKey: 'accountDetection' },
  { value: 'transfer', labelKey: 'transferRule' },
];

const ACTIVE_OPTIONS: { value: ActiveFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'allStatus' },
  { value: 'active', labelKey: 'active' },
  { value: 'inactive', labelKey: 'inactive' },
];

const ruleTypeBadgeVariant: Record<RuleType, 'default' | 'secondary' | 'outline'> = {
  general: 'secondary',
  account_detection: 'default',
  transfer: 'outline',
};

export default function AutomationPage(): React.ReactElement {
  const t = useTranslations('automation');
  const tCommon = useTranslations('common');
  const [ruleTypeFilter, setRuleTypeFilter] = useState<RuleTypeFilter>('all');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiInitialData, setAiInitialData] = useState<CreateAutomationRuleInput | null>(null);
  const [aiPromptText, setAiPromptText] = useState<string>('');
  const [search, setSearch] = useState('');

  const filters = {
    ...(ruleTypeFilter !== 'all' ? { rule_type: ruleTypeFilter } : {}),
    ...(activeFilter !== 'all' ? { is_active: activeFilter === 'active' } : {}),
  };

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteAutomationRules(filters);
  const { data: accounts } = useAccounts();
  const toggleMutation = useToggleAutomationRule();
  const deleteMutation = useDeleteAutomationRule();
  const generateMutation = useGenerateAccountRules();

  const bottomRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return (): void => observer.disconnect();
  }, [handleObserver]);

  const allRulesRaw = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data?.pages]);

  const allRules = useMemo((): AutomationRule[] => {
    const q = search.trim().toLowerCase();
    if (!q) return allRulesRaw;
    return allRulesRaw.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.conditions.raw_text_contains?.some((term) => term.toLowerCase().includes(q)),
    );
  }, [allRulesRaw, search]);

  // Hide auto-generate when user has no non-default accounts or all active ones are covered
  const allActiveAccountsCovered = ((): boolean => {
    if (!accounts) return false;
    const nonDefaultAccounts = accounts.filter((a) => !a.is_default);
    if (nonDefaultAccounts.length === 0) return true;
    const activeAccounts = nonDefaultAccounts.filter((a) => a.is_active);
    if (activeAccounts.length === 0) return true;
    const coveredAccountIds = new Set(
      allRulesRaw
        .filter((r) => r.rule_type === 'account_detection' && r.actions.set_account)
        .map((r) => r.actions.set_account),
    );
    return activeAccounts.every((a) => coveredAccountIds.has(a.id));
  })();

  const getAccountName = (accountId: string | null): string | null => {
    if (!accountId || !accounts) return null;
    return accounts.find((a) => a.id === accountId)?.name ?? null;
  };

  const handleToggle = (rule: AutomationRule, checked: boolean): void => {
    toggleMutation.mutate(
      { id: rule.id, is_active: checked },
      {
        onError: () => {
          toast.error(t('failedToToggle'));
        },
      },
    );
  };

  const handleEdit = (rule: AutomationRule): void => {
    setEditingRule(rule);
    setAiInitialData(null);
    setAiPromptText('');
    setFormOpen(true);
  };

  const handleCreate = (): void => {
    setEditingRule(null);
    setAiInitialData(null);
    setAiPromptText('');
    setFormOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(t('ruleDeleted'));
      setDeleteTarget(null);
    } catch {
      toast.error(t('failedToDelete'));
    }
  };

  const handleAiRuleSelected = (rule: CreateAutomationRuleInput, prompt: string): void => {
    setAiInitialData(rule);
    setAiPromptText(prompt);
    setEditingRule(null);
    setFormOpen(true);
  };

  const handleGenerateAccountRules = async (): Promise<void> => {
    try {
      const result = await generateMutation.mutateAsync();
      toast.success(result.message);
      setGenerateConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('failedToGenerate'));
    }
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='space-y-3 sm:space-y-0'>
        {/* Mobile: search full-width */}
        <div className='relative sm:hidden'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder={`${tCommon('search')}...`}
            value={search}
            onChange={(e): void => setSearch(e.target.value)}
            className='h-9 pr-8 pl-10 text-sm'
          />
          {search && (
            <button
              type='button'
              onClick={(): void => setSearch('')}
              className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer'>
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        {/* Mobile: selects + actions in one row */}
        <div className='flex items-center gap-2 sm:justify-between'>
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            {/* Desktop: search inline with selects */}
            <div className='relative hidden max-w-[280px] min-w-[180px] flex-1 sm:block'>
              <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
              <Input
                placeholder={`${tCommon('search')}...`}
                value={search}
                onChange={(e): void => setSearch(e.target.value)}
                className='h-9 pr-8 pl-10 text-sm'
              />
              {search && (
                <button
                  type='button'
                  onClick={(): void => setSearch('')}
                  className='text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer'>
                  <X className='h-4 w-4' />
                </button>
              )}
            </div>
            <Select
              value={ruleTypeFilter}
              onValueChange={(v): void => setRuleTypeFilter(v as RuleTypeFilter)}>
              <SelectTrigger className='min-w-0 flex-1 sm:w-auto sm:min-w-[140px] sm:flex-none'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={activeFilter}
              onValueChange={(v): void => setActiveFilter(v as ActiveFilter)}>
              <SelectTrigger className='min-w-0 flex-1 sm:w-auto sm:min-w-[140px] sm:flex-none'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex shrink-0 gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='ai-gradient-btn cursor-pointer'
              onClick={(): void => setAiDialogOpen(true)}>
              <Sparkles className='h-4 w-4 sm:mr-1.5' />
              <span className='hidden sm:inline'>{t('createWithAi')}</span>
            </Button>
            {!allActiveAccountsCovered && (
              <Button
                variant='outline'
                size='sm'
                className='cursor-pointer'
                onClick={(): void => setGenerateConfirmOpen(true)}>
                <Wand2 className='h-4 w-4 sm:mr-1.5' />
                <span className='hidden sm:inline'>{t('autoGenerate')}</span>
              </Button>
            )}
            <Button className='cursor-pointer' onClick={handleCreate}>
              <Plus className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>{t('newRule')}</span>
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className='space-y-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-32 w-full' />
          ))}
        </div>
      ) : allRules.length === 0 ? (
        <Card className='border-border bg-card'>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Zap className='text-muted-foreground mb-4 h-12 w-12' />
            <p className='text-muted-foreground mb-4'>{t('noRules')}</p>
            <Button className='cursor-pointer' onClick={handleCreate}>
              <Plus className='mr-2 h-4 w-4' />
              {t('addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {allRules.map((rule) => {
            const transferAccount = getAccountName(rule.transfer_to_account_id);

            const ruleCardContent = (
              <Card className='border-border bg-card'>
                <CardHeader className='flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:gap-4'>
                  <div className='min-w-0 flex-1'>
                    <CardTitle className='text-base font-medium'>{rule.name}</CardTitle>
                    <div className='mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2'>
                      <Badge variant={ruleTypeBadgeVariant[rule.rule_type]} className='text-xs'>
                        {rule.rule_type === 'account_detection'
                          ? t('accountDetection')
                          : rule.rule_type === 'transfer'
                            ? t('transferRule')
                            : t('general')}
                      </Badge>
                      <Badge variant='outline' className='font-mono text-xs'>
                        {rule.condition_logic.toUpperCase()}
                      </Badge>
                      <Badge variant='outline'>
                        {t('priority')}: {rule.priority}
                      </Badge>
                      {transferAccount && (
                        <Badge variant='secondary'>
                          <span className='hidden sm:inline'>{t('transferRule')}: </span>
                          {transferAccount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Desktop action buttons */}
                  <div className='hidden items-center gap-2 sm:flex'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(): void => handleEdit(rule)}
                      className='h-8 w-8 cursor-pointer p-0'>
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(): void => setDeleteTarget(rule)}
                      className='text-destructive h-8 w-8 cursor-pointer p-0'>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked): void => handleToggle(rule, checked)}
                    />
                  </div>
                  {/* Mobile: only show toggle */}
                  <div className='flex items-center gap-2 sm:hidden'>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked): void => handleToggle(rule, checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {Object.keys(rule.conditions).length > 0 && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>
                        {t('conditions')}
                      </p>
                      <div className='flex flex-wrap gap-1'>
                        {rule.conditions.raw_text_contains?.map((term) => (
                          <Badge key={term} variant='outline' className='text-xs'>
                            {t('rawTextContains').toLowerCase()}: &quot;{term}&quot;
                          </Badge>
                        ))}
                        {rule.conditions.amount_between && (
                          <Badge variant='outline' className='text-xs'>
                            {t('amountGreaterThan').toLowerCase()}:{' '}
                            {rule.conditions.amount_between[0]} -{' '}
                            {rule.conditions.amount_between[1]}
                          </Badge>
                        )}
                        {rule.conditions.source?.map((s) => (
                          <Badge key={s} variant='outline' className='text-xs'>
                            {t('conditionSource').toLowerCase()}: {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(rule.actions).length > 0 && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>
                        {t('actions')}
                      </p>
                      <div className='flex flex-wrap gap-1'>
                        {rule.actions.set_type && (
                          <Badge variant='default' className='text-xs'>
                            {t('setType').toLowerCase()}: {rule.actions.set_type}
                          </Badge>
                        )}
                        {rule.actions.set_category && (
                          <Badge variant='default' className='text-xs'>
                            {t('setCategory').toLowerCase()}
                          </Badge>
                        )}
                        {rule.actions.set_account && (
                          <Badge variant='default' className='text-xs'>
                            {t('setAccount').toLowerCase()}:{' '}
                            {getAccountName(rule.actions.set_account) ?? 'unknown'}
                          </Badge>
                        )}
                        {rule.actions.auto_reconcile && (
                          <Badge variant='default' className='text-xs'>
                            {t('autoReconcile').toLowerCase()}
                          </Badge>
                        )}
                        {rule.actions.add_note && (
                          <Badge variant='default' className='text-xs'>
                            {t('addNote').toLowerCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );

            return (
              <div key={rule.id}>
                {/* Desktop: regular card with click-to-edit */}
                <div className='hidden sm:block'>{ruleCardContent}</div>
                {/* Mobile: swipeable card */}
                <div className='sm:hidden'>
                  <SwipeableRow
                    onEdit={(): void => handleEdit(rule)}
                    onDelete={(): void => setDeleteTarget(rule)}>
                    {ruleCardContent}
                  </SwipeableRow>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={bottomRef} className='flex justify-center py-4'>
        {isFetchingNextPage ? (
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        ) : hasNextPage ? (
          <Button variant='ghost' size='sm' onClick={(): void => void fetchNextPage()}>
            {tCommon('loadMore')}
          </Button>
        ) : allRules.length > 0 ? (
          <p className='text-muted-foreground text-xs'>{t('noMoreRules')}</p>
        ) : null}
      </div>

      <AutomationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        rule={editingRule}
        initialData={aiInitialData}
        aiPrompt={aiPromptText}
      />

      <AiAutomationDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onUseRule={handleAiRuleSelected}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open): void => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('deleteRule')}
        description={<p className='text-muted-foreground text-sm'>{t('deleteRuleConfirm')}</p>}
        confirmText={deleteTarget?.name ?? ''}
        onConfirm={(): void => void handleDeleteConfirm()}
        isPending={deleteMutation.isPending}
      />

      {/* Generate account rules confirmation dialog */}
      <AlertDialog open={generateConfirmOpen} onOpenChange={setGenerateConfirmOpen}>
        <AlertDialogContent className='border-border bg-card'>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('autoGenerateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('autoGenerateDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='cursor-pointer'>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className='cursor-pointer'
              disabled={generateMutation.isPending}
              onClick={(e): void => {
                e.preventDefault();
                void handleGenerateAccountRules();
              }}>
              {generateMutation.isPending ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {tCommon('generating')}
                </>
              ) : (
                t('generateRules')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
