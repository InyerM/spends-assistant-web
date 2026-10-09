'use client';

import { useState, useMemo } from 'react';
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
import { AutomationRuleExplanation } from '@/components/automation/automation-rule-explanation';
import { AutomationForm } from '@/components/automation/automation-form';
import { AiAutomationDialog } from '@/components/automation/ai-automation-dialog';
import { useInfiniteAutomationRules } from '@/lib/api/queries/automation.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import {
  useToggleAutomationRule,
  useDeleteAutomationRule,
  useGenerateAccountRules,
} from '@/lib/api/mutations/automation.mutations';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { SearchInput } from '@/components/shared/search-input';
import { useAllCategories } from '@/lib/api/queries/category.queries';
import { useLocale } from 'next-intl';
import { findById } from '@/lib/utils/lookup';
import { Plus, Pencil, Trash2, Zap, Wand2, Sparkles } from 'lucide-react';
import { InlineLoader } from '@/components/shared/loader';
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
  const locale = useLocale();
  const { data: categories } = useAllCategories();
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

  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteAutomationRules(filters);
  const { data: accounts } = useAccounts();
  const toggleMutation = useToggleAutomationRule();
  const deleteMutation = useDeleteAutomationRule();
  const generateMutation = useGenerateAccountRules();

  const bottomRef = useInfiniteScroll({ fetchNextPage, hasNextPage, isFetchingNextPage });

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
    return findById(accounts, accountId)?.name ?? null;
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
    <div className='mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold tracking-tight'>{t('title')}</h1>
          <p className='text-muted-foreground max-w-2xl text-sm'>{t('subtitle')}</p>
        </div>
        <div className='flex w-full flex-wrap gap-2 sm:w-auto'>
          <Button
            variant='ai'
            size='sm'
            className='min-h-11 cursor-pointer'
            aria-label={t('createWithAi')}
            onClick={(): void => setAiDialogOpen(true)}>
            <Sparkles className='h-4 w-4 sm:mr-1.5' />
            <span className='inline'>{t('createWithAi')}</span>
          </Button>
          {!allActiveAccountsCovered && (
            <Button
              variant='outline'
              size='sm'
              className='min-h-11 cursor-pointer'
              aria-label={t('autoGenerate')}
              onClick={(): void => setGenerateConfirmOpen(true)}>
              <Wand2 className='h-4 w-4 sm:mr-1.5' />
              <span className='inline'>{t('autoGenerate')}</span>
            </Button>
          )}
          <Button
            className='min-h-11 cursor-pointer'
            aria-label={t('newRule')}
            onClick={handleCreate}>
            <Plus className='h-4 w-4 sm:mr-2' />
            <span className='inline'>{t('newRule')}</span>
          </Button>
        </div>
      </header>
      <div className='bg-card border-border flex flex-col gap-3 rounded-2xl border p-4 lg:flex-row lg:items-center'>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`${tCommon('search')}...`}
          clearLabel={tCommon('reset')}
          className='w-full lg:max-w-sm'
        />
        <div className='flex min-w-0 flex-1 flex-wrap gap-2'>
          <Select
            value={ruleTypeFilter}
            onValueChange={(v): void => setRuleTypeFilter(v as RuleTypeFilter)}>
            <SelectTrigger
              aria-label={t('ruleType')}
              className='h-11 w-full min-w-0 sm:w-auto sm:min-w-[160px] sm:flex-none'>
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
            <SelectTrigger
              aria-label={t('allStatus')}
              className='h-11 w-full min-w-0 sm:w-auto sm:min-w-[160px] sm:flex-none'>
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
      </div>

      {isError ? (
        <div role='alert' className='bg-card border-border space-y-3 rounded-2xl border p-6'>
          <p>{t('loadError')}</p>
          <Button
            variant='outline'
            onClick={(): void => {
              void refetch();
            }}>
            {tCommon('tryAgain')}
          </Button>
        </div>
      ) : isLoading ? (
        <div className='space-y-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-32 w-full' />
          ))}
        </div>
      ) : allRules.length === 0 ? (
        <Card className='border-border bg-card overflow-hidden rounded-2xl shadow-none'>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Zap className='text-muted-foreground mb-4 h-12 w-12' />
            <h2 className='mb-2 text-lg font-semibold'>
              {search || ruleTypeFilter !== 'all' || activeFilter !== 'all'
                ? tCommon('noResults')
                : t('noRules')}
            </h2>
            <p className='text-muted-foreground mb-4 max-w-md text-center text-sm'>
              {search || ruleTypeFilter !== 'all' || activeFilter !== 'all'
                ? t('noResultsDescription')
                : t('noRulesDescription')}
            </p>
            {search || ruleTypeFilter !== 'all' || activeFilter !== 'all' ? (
              <Button
                variant='outline'
                onClick={(): void => {
                  setSearch('');
                  setRuleTypeFilter('all');
                  setActiveFilter('all');
                }}>
                {tCommon('reset')}
              </Button>
            ) : (
              <Button className='cursor-pointer' aria-label={t('newRule')} onClick={handleCreate}>
                <Plus className='mr-2 h-4 w-4' />
                {t('addFirst')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {allRules.map((rule) => {
            const transferAccount = getAccountName(rule.transfer_to_account_id);

            const ruleCardContent = (
              <Card className='border-border bg-card overflow-hidden rounded-2xl shadow-none'>
                <CardHeader className='flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:gap-4'>
                  <div className='min-w-0 flex-1'>
                    <CardTitle className='text-lg font-semibold break-words'>{rule.name}</CardTitle>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t(rule.is_active ? 'active' : 'inactive')}
                    </p>
                    <div className='mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2'>
                      <Badge variant={ruleTypeBadgeVariant[rule.rule_type]} className='text-xs'>
                        {rule.rule_type === 'account_detection'
                          ? t('accountDetection')
                          : rule.rule_type === 'transfer'
                            ? t('transferRule')
                            : t('general')}
                      </Badge>
                      <Badge variant='outline' className='text-xs'>
                        {tCommon(rule.condition_logic === 'and' ? 'and' : 'or')}
                      </Badge>
                      <Badge variant='outline'>
                        {t('priority')}: {rule.priority}
                      </Badge>
                      {rule.managed_account_id ? (
                        <Badge variant='outline' className='text-brand'>
                          {t('managedRule')}
                        </Badge>
                      ) : null}
                      {transferAccount && (
                        <Badge variant='secondary'>
                          <span className='hidden sm:inline'>{t('transferRule')}: </span>
                          {transferAccount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Keep rule actions available to touch and keyboard users. */}
                  <div className='flex items-center gap-2'>
                    <Button
                      disabled={Boolean(rule.managed_account_id)}
                      variant='ghost'
                      size='sm'
                      onClick={(): void => handleEdit(rule)}
                      aria-label={`${t('editRule')} ${rule.name}`}
                      className='h-11 w-11 cursor-pointer p-0'>
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      disabled={Boolean(rule.managed_account_id)}
                      onClick={(): void => setDeleteTarget(rule)}
                      aria-label={`${t('deleteRule')} ${rule.name}`}
                      className='text-destructive h-11 w-11 cursor-pointer p-0'>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                    <Switch
                      aria-label={`${t('isActive')} ${rule.name}`}
                      disabled={toggleMutation.isPending || Boolean(rule.managed_account_id)}
                      checked={rule.is_active}
                      onCheckedChange={(checked): void => handleToggle(rule, checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className='border-border grid gap-4 border-t pt-4 sm:grid-cols-2'>
                  <AutomationRuleExplanation rule={rule} autoLoad />
                  {rule.managed_account_id ? (
                    <p className='text-muted-foreground text-sm sm:col-span-2'>
                      {t('managedRuleDescription')}
                    </p>
                  ) : null}
                  {Object.keys(rule.conditions).length > 0 && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>
                        {t('conditions')}
                      </p>
                      <div className='flex flex-wrap gap-1'>
                        {rule.conditions.raw_text_contains?.map((term) => (
                          <Badge
                            key={term}
                            variant='outline'
                            className='max-w-full text-xs break-words whitespace-normal'>
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
                          <Badge
                            variant='secondary'
                            className='max-w-full text-xs break-words whitespace-normal'>
                            {t('setType').toLowerCase()}: {rule.actions.set_type}
                          </Badge>
                        )}
                        {rule.actions.set_category && (
                          <Badge
                            variant='secondary'
                            className='max-w-full text-xs break-words whitespace-normal'>
                            {t('setCategory').toLowerCase()}:{' '}
                            {findById(categories ?? [], rule.actions.set_category)?.translations?.[
                              locale
                            ] ??
                              findById(categories ?? [], rule.actions.set_category)?.name ??
                              tCommon('none')}
                          </Badge>
                        )}
                        {rule.actions.set_account && (
                          <Badge
                            variant='secondary'
                            className='max-w-full text-xs break-words whitespace-normal'>
                            {t('setAccount').toLowerCase()}:{' '}
                            {getAccountName(rule.actions.set_account) ?? tCommon('none')}
                          </Badge>
                        )}
                        {rule.actions.auto_reconcile && (
                          <Badge
                            variant='secondary'
                            className='max-w-full text-xs break-words whitespace-normal'>
                            {t('autoReconcile').toLowerCase()}
                          </Badge>
                        )}
                        {rule.actions.add_note && (
                          <Badge
                            variant='secondary'
                            className='max-w-full text-xs break-words whitespace-normal'>
                            {t('addNote').toLowerCase()}: {rule.actions.add_note}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );

            return <div key={rule.id}>{ruleCardContent}</div>;
          })}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={bottomRef} className='flex justify-center py-4'>
        {isFetchingNextPage ? (
          <InlineLoader className='h-5 w-5' />
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
                  <InlineLoader className='mr-2' />
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
