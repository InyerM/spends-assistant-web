'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Plus, X } from 'lucide-react';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useAppSettings } from '@/hooks/use-app-settings';
import {
  useCreateAutomationRule,
  useUpdateAutomationRule,
} from '@/lib/api/mutations/automation.mutations';
import type {
  AutomationRule,
  AutomationRuleConditions,
  AutomationRuleActions,
  ConditionLogic,
  CreateAutomationRuleInput,
  RuleType,
} from '@/types';

// ── Condition / Action row types ──────────────────────────────────────────

type ConditionType =
  | 'raw_text_contains'
  | 'source'
  | 'amount_greater_than'
  | 'amount_less_than'
  | 'type';

interface ConditionRow {
  id: string;
  type: ConditionType;
  value: string;
}

type ActionType =
  | 'set_category'
  | 'set_type'
  | 'set_account'
  | 'transfer_to_account'
  | 'auto_reconcile'
  | 'add_note';

interface ActionRow {
  id: string;
  type: ActionType;
  value: string;
}

const CONDITION_TYPE_KEYS: Record<ConditionType, string> = {
  raw_text_contains: 'rawTextContains',
  source: 'conditionSource',
  amount_greater_than: 'amountGreaterThan',
  amount_less_than: 'amountLessThan',
  type: 'transactionType',
};

const ACTION_TYPE_KEYS: Record<ActionType, string> = {
  set_category: 'setCategory',
  set_type: 'setType',
  set_account: 'setAccount',
  transfer_to_account: 'transferToAccount',
  auto_reconcile: 'autoReconcile',
  add_note: 'addNote',
};

const RULE_TYPE_KEYS: Record<RuleType, string> = {
  general: 'general',
  account_detection: 'accountDetection',
  transfer: 'transferRule',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function InfoTip({ text }: { text: string }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground inline-flex cursor-help'
          tabIndex={-1}>
          <Info className='h-3.5 w-3.5' />
        </button>
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-72 whitespace-pre-line'>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Schema ────────────────────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  is_active: z.boolean(),
  priority: z.number().int(),
  rule_type: z.enum(['general', 'account_detection', 'transfer']),
  condition_logic: z.enum(['and', 'or']),
});

type FormValues = z.infer<typeof formSchema>;

// ── Helpers to convert existing rule to dynamic rows ──────────────────────

function conditionsToRows(conditions: AutomationRuleConditions): ConditionRow[] {
  const rows: ConditionRow[] = [];
  if (conditions.raw_text_contains) {
    for (const term of conditions.raw_text_contains) {
      rows.push({ id: generateId(), type: 'raw_text_contains', value: term });
    }
  }
  if (conditions.source) {
    for (const s of conditions.source) {
      rows.push({ id: generateId(), type: 'source', value: s });
    }
  }
  if (conditions.amount_between) {
    rows.push({
      id: generateId(),
      type: 'amount_greater_than',
      value: String(conditions.amount_between[0]),
    });
    rows.push({
      id: generateId(),
      type: 'amount_less_than',
      value: String(conditions.amount_between[1]),
    });
  }
  return rows;
}

function actionsToRows(
  actions: AutomationRuleActions,
  transferToAccountId?: string | null,
): ActionRow[] {
  const rows: ActionRow[] = [];
  if (actions.set_type) {
    rows.push({ id: generateId(), type: 'set_type', value: actions.set_type });
  }
  if (actions.set_category) {
    rows.push({ id: generateId(), type: 'set_category', value: actions.set_category });
  }
  if (actions.set_account) {
    rows.push({ id: generateId(), type: 'set_account', value: actions.set_account });
  }
  if (actions.link_to_account || transferToAccountId) {
    rows.push({
      id: generateId(),
      type: 'transfer_to_account',
      value: actions.link_to_account ?? transferToAccountId ?? '',
    });
  }
  if (actions.auto_reconcile) {
    rows.push({ id: generateId(), type: 'auto_reconcile', value: 'true' });
  }
  if (actions.add_note) {
    rows.push({ id: generateId(), type: 'add_note', value: actions.add_note });
  }
  return rows;
}

// ── Condition value input component ───────────────────────────────────────

function ConditionValueInput({
  row,
  onChange,
}: {
  row: ConditionRow;
  onChange: (value: string) => void;
}): React.ReactElement {
  const t = useTranslations('automation');
  const tTx = useTranslations('transactions');

  if (row.type === 'type') {
    return (
      <Select value={row.value || undefined} onValueChange={onChange}>
        <SelectTrigger className='h-9 flex-1'>
          <SelectValue placeholder={tTx('selectType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='expense'>{tTx('expense')}</SelectItem>
          <SelectItem value='income'>{tTx('income')}</SelectItem>
          <SelectItem value='transfer'>{tTx('transfer')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (row.type === 'amount_greater_than' || row.type === 'amount_less_than') {
    return (
      <Input
        type='number'
        placeholder='0'
        className='h-9 flex-1'
        value={row.value}
        onChange={(e): void => onChange(e.target.value)}
      />
    );
  }
  if (row.type === 'source') {
    return (
      <Input
        placeholder={t('sourcePlaceholder')}
        className='h-9 flex-1'
        value={row.value}
        onChange={(e): void => onChange(e.target.value)}
      />
    );
  }
  // raw_text_contains
  return (
    <Input
      placeholder={t('rawTextPlaceholder')}
      className='h-9 flex-1'
      value={row.value}
      onChange={(e): void => onChange(e.target.value)}
    />
  );
}

// ── Action value input component ──────────────────────────────────────────

function ActionValueInput({
  row,
  onChange,
  accounts,
  categories,
}: {
  row: ActionRow;
  onChange: (value: string) => void;
  accounts: ReturnType<typeof useAccounts>['data'];
  categories: ReturnType<typeof useCategories>['data'];
}): React.ReactElement {
  const t = useTranslations('automation');
  const tTx = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  if (row.type === 'set_type') {
    return (
      <Select value={row.value || undefined} onValueChange={onChange}>
        <SelectTrigger className='h-9 flex-1'>
          <SelectValue placeholder={tTx('selectType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='expense'>{tTx('expense')}</SelectItem>
          <SelectItem value='income'>{tTx('income')}</SelectItem>
          <SelectItem value='transfer'>{tTx('transfer')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (row.type === 'set_category') {
    return (
      <div className='flex-1'>
        <SearchableSelect
          value={row.value || undefined}
          onValueChange={onChange}
          placeholder={tTx('selectCategory')}
          searchPlaceholder={tTx('searchCategories')}
          items={buildCategoryItems(categories ?? [], undefined, {
            locale: locale as 'en' | 'es' | 'pt',
            allPrefix: (name: string): string => tCommon('allOf', { name }),
          })}
        />
      </div>
    );
  }
  if (row.type === 'set_account' || row.type === 'transfer_to_account') {
    return (
      <div className='flex-1'>
        <SearchableSelect
          value={row.value || undefined}
          onValueChange={onChange}
          placeholder={tTx('selectAccount')}
          searchPlaceholder={tTx('searchAccounts')}
          items={buildAccountItems(accounts ?? [])}
        />
      </div>
    );
  }
  if (row.type === 'auto_reconcile') {
    return (
      <div className='flex flex-1 items-center'>
        <Switch
          checked={row.value === 'true'}
          onCheckedChange={(checked): void => onChange(checked ? 'true' : 'false')}
        />
        <span className='text-muted-foreground ml-2 text-sm'>
          {row.value === 'true' ? tCommon('enabled') : tCommon('disabled')}
        </span>
      </div>
    );
  }
  // add_note
  return (
    <Input
      placeholder={t('notePlaceholder')}
      className='h-9 flex-1'
      value={row.value}
      onChange={(e): void => onChange(e.target.value)}
    />
  );
}

// ── Main Form ─────────────────────────────────────────────────────────────

interface AutomationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: AutomationRule | null;
  initialData?: CreateAutomationRuleInput | null;
  aiPrompt?: string;
}

function getDefaults(rule?: AutomationRule | null): FormValues {
  if (!rule) {
    return {
      name: '',
      is_active: true,
      priority: 0,
      rule_type: 'general',
      condition_logic: 'and',
    };
  }
  return {
    name: rule.name,
    is_active: rule.is_active,
    priority: rule.priority,
    rule_type: rule.rule_type,
    condition_logic: rule.condition_logic,
  };
}

export function AutomationForm({
  open,
  onOpenChange,
  rule,
  initialData,
  aiPrompt,
}: AutomationFormProps): React.ReactElement {
  const t = useTranslations('automation');
  const tCommon = useTranslations('common');
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: appSettings } = useAppSettings();
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();
  const isEditing = !!rule;

  const [conditionRows, setConditionRows] = useState<ConditionRow[]>([]);
  const [actionRows, setActionRows] = useState<ActionRow[]>([]);
  const [addingCondition, setAddingCondition] = useState(false);
  const [addingAction, setAddingAction] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(rule),
  });

  // Reset local state when dialog opens (set state during render pattern)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    if (rule) {
      setConditionRows(conditionsToRows(rule.conditions));
      setActionRows(actionsToRows(rule.actions, rule.transfer_to_account_id));
    } else if (initialData) {
      setConditionRows(conditionsToRows(initialData.conditions));
      setActionRows(actionsToRows(initialData.actions, initialData.transfer_to_account_id ?? null));
    } else {
      setConditionRows([]);
      setActionRows([]);
    }
    setAddingCondition(false);
    setAddingAction(false);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  // Reset form values when dialog opens
  useEffect(() => {
    if (open) {
      if (initialData && !rule) {
        form.reset({
          name: initialData.name,
          is_active: initialData.is_active ?? true,
          priority: initialData.priority ?? 0,
          rule_type: initialData.rule_type ?? 'general',
          condition_logic: initialData.condition_logic ?? 'and',
        });
      } else {
        form.reset(getDefaults(rule));
      }
    }
  }, [open, rule, initialData, form]);

  // ── Condition row management ──────────────────────────────────────────

  const addCondition = useCallback((type: ConditionType): void => {
    setConditionRows((prev) => [...prev, { id: generateId(), type, value: '' }]);
    setAddingCondition(false);
  }, []);

  const updateConditionValue = useCallback((id: string, value: string): void => {
    setConditionRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  }, []);

  const removeCondition = useCallback((id: string): void => {
    setConditionRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Action row management ─────────────────────────────────────────────

  const addAction = useCallback((type: ActionType): void => {
    const defaultValue = type === 'auto_reconcile' ? 'true' : '';
    setActionRows((prev) => [...prev, { id: generateId(), type, value: defaultValue }]);
    setAddingAction(false);
  }, []);

  const updateActionValue = useCallback((id: string, value: string): void => {
    setActionRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  }, []);

  const removeAction = useCallback((id: string): void => {
    setActionRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Build payload ─────────────────────────────────────────────────────

  function buildPayload(values: FormValues): CreateAutomationRuleInput {
    const conditions: AutomationRuleConditions = {};
    const rawTextTerms: string[] = [];
    const sourceTerms: string[] = [];
    let amountMin: number | undefined;
    let amountMax: number | undefined;

    for (const row of conditionRows) {
      if (!row.value.trim()) continue;
      switch (row.type) {
        case 'raw_text_contains':
          rawTextTerms.push(row.value.trim());
          break;
        case 'source':
          sourceTerms.push(row.value.trim());
          break;
        case 'amount_greater_than':
          amountMin = Number(row.value);
          break;
        case 'amount_less_than':
          amountMax = Number(row.value);
          break;
        case 'type':
          // stored as a condition if needed; for now map to source-style
          break;
      }
    }

    if (rawTextTerms.length > 0) conditions.raw_text_contains = rawTextTerms;
    if (sourceTerms.length > 0) conditions.source = sourceTerms;
    if (amountMin !== undefined && amountMax !== undefined) {
      conditions.amount_between = [amountMin, amountMax];
    } else if (amountMin !== undefined) {
      conditions.amount_between = [amountMin, Number.MAX_SAFE_INTEGER];
    } else if (amountMax !== undefined) {
      conditions.amount_between = [0, amountMax];
    }

    const actions: AutomationRuleActions = {};
    let transferToAccountId: string | undefined;

    for (const row of actionRows) {
      if (!row.value.trim() && row.type !== 'auto_reconcile') continue;
      switch (row.type) {
        case 'set_type':
          actions.set_type = row.value as 'expense' | 'income' | 'transfer';
          break;
        case 'set_category':
          actions.set_category = row.value;
          break;
        case 'set_account':
          actions.set_account = row.value;
          break;
        case 'transfer_to_account':
          actions.link_to_account = row.value;
          transferToAccountId = row.value;
          break;
        case 'auto_reconcile':
          if (row.value === 'true') actions.auto_reconcile = true;
          break;
        case 'add_note':
          actions.add_note = row.value.trim();
          break;
      }
    }

    return {
      name: values.name,
      is_active: values.is_active,
      priority: values.priority,
      rule_type: values.rule_type,
      condition_logic: values.condition_logic,
      transfer_to_account_id: transferToAccountId,
      conditions,
      actions,
    };
  }

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      const payload = buildPayload(values);
      if (aiPrompt) {
        (payload as unknown as Record<string, unknown>).ai_prompt = aiPrompt;
      }
      if (isEditing) {
        await updateMutation.mutateAsync({ id: rule.id, ...payload });
        toast.success(t('ruleUpdated'));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t('ruleCreated'));
      }
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? t('failedToUpdate') : t('failedToCreate'));
    }
  }

  // Already-used condition/action types for filtering the dropdowns
  const usedConditionTypes = new Set(conditionRows.map((r) => r.type));
  const usedActionTypes = new Set(actionRows.map((r) => r.type));

  // Allow duplicates for raw_text_contains and source
  const availableConditionTypes = (Object.keys(CONDITION_TYPE_KEYS) as ConditionType[]).filter(
    (ct) => ct === 'raw_text_contains' || ct === 'source' || !usedConditionTypes.has(ct),
  );

  const availableActionTypes = (Object.keys(ACTION_TYPE_KEYS) as ActionType[]).filter(
    (at) => !usedActionTypes.has(at),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[550px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editRule') : t('newRule')}</DialogTitle>
        </DialogHeader>

        <TooltipProvider>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              {/* ── Name + Priority ─────────────────────────────────── */}
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }): React.ReactElement => (
                    <FormItem className='col-span-2 sm:col-span-1'>
                      <FormLabel>{t('name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='priority'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel className='inline-flex items-center gap-1.5'>
                        {t('priority')}
                        <InfoTip text={t('priorityTooltip')} />
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          {...field}
                          onChange={(e): void => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Rule Type + Active ──────────────────────────────── */}
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='rule_type'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel className='inline-flex items-center gap-1.5'>
                        {t('ruleType')}
                        <InfoTip
                          text={`${t('general')}: ${t('ruleTypeGeneralTooltip')}\n${t('accountDetection')}: ${t('ruleTypeAccountDetectionTooltip')}\n${t('transferRule')}: ${t('ruleTypeTransferTooltip')}`}
                        />
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('ruleType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(RULE_TYPE_KEYS) as RuleType[]).map((rt) => (
                            <SelectItem key={rt} value={rt}>
                              {t(RULE_TYPE_KEYS[rt])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='is_active'
                  render={({ field }): React.ReactElement => (
                    <FormItem className='flex flex-col justify-end'>
                      <FormLabel>{t('isActive')}</FormLabel>
                      <div className='flex h-9 items-center'>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Conditions section ──────────────────────────────── */}
              <div className='border-border space-y-3 rounded-lg border p-3'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5'>
                    <p className='text-sm font-medium'>{t('conditions')}</p>
                    <InfoTip text={`${t('conditionsHelp')}. ${t('conditionsExample')}`} />
                  </div>

                  {/* AND / OR toggle */}
                  <FormField
                    control={form.control}
                    name='condition_logic'
                    render={({ field }): React.ReactElement => (
                      <FormItem className='flex items-center gap-2'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className='bg-muted inline-flex h-8 items-center rounded-md p-0.5'>
                              <button
                                type='button'
                                className={`cursor-pointer rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
                                  field.value === 'and'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={(): void => field.onChange('and' as ConditionLogic)}>
                                AND
                              </button>
                              <button
                                type='button'
                                className={`cursor-pointer rounded-sm px-3 py-1 text-xs font-medium transition-colors ${
                                  field.value === 'or'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={(): void => field.onChange('or' as ConditionLogic)}>
                                OR
                              </button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side='top' className='max-w-64'>
                            {t('conditionLogicTooltip')}
                          </TooltipContent>
                        </Tooltip>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Existing conditions as compact rows */}
                {conditionRows.length > 0 && (
                  <div className='space-y-2'>
                    {conditionRows.map((row) => (
                      <div key={row.id} className='flex items-center gap-2'>
                        <Badge variant='secondary' className='shrink-0 text-xs'>
                          {t(CONDITION_TYPE_KEYS[row.type])}
                        </Badge>
                        <ConditionValueInput
                          row={row}
                          onChange={(v): void => updateConditionValue(row.id, v)}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 cursor-pointer p-0'
                          onClick={(): void => removeCondition(row.id)}>
                          <X className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add condition button / dropdown */}
                {addingCondition ? (
                  <div className='flex flex-wrap gap-1.5'>
                    {availableConditionTypes.map((type) => (
                      <Button
                        key={type}
                        type='button'
                        variant='outline'
                        size='sm'
                        className='h-7 cursor-pointer text-xs'
                        onClick={(): void => addCondition(type)}>
                        {t(CONDITION_TYPE_KEYS[type])}
                      </Button>
                    ))}
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-7 cursor-pointer text-xs'
                      onClick={(): void => setAddingCondition(false)}>
                      {tCommon('cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='h-8 w-full cursor-pointer text-xs'
                    onClick={(): void => setAddingCondition(true)}>
                    <Plus className='mr-1.5 h-3 w-3' />
                    {t('addCondition')}
                  </Button>
                )}
              </div>

              {/* ── Actions section ─────────────────────────────────── */}
              <div className='border-border space-y-3 rounded-lg border p-3'>
                <div className='flex items-center gap-1.5'>
                  <p className='text-sm font-medium'>{t('actions')}</p>
                  <InfoTip text={`${t('actionsHelp')}. ${t('actionsExample')}`} />
                </div>

                {/* Existing actions as compact rows */}
                {actionRows.length > 0 && (
                  <div className='space-y-2'>
                    {actionRows.map((row) => (
                      <div key={row.id} className='flex items-center gap-2'>
                        <Badge variant='default' className='shrink-0 text-xs'>
                          {t(ACTION_TYPE_KEYS[row.type])}
                        </Badge>
                        <ActionValueInput
                          row={row}
                          onChange={(v): void => updateActionValue(row.id, v)}
                          accounts={accounts}
                          categories={categories}
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='text-muted-foreground hover:text-destructive h-8 w-8 shrink-0 cursor-pointer p-0'
                          onClick={(): void => removeAction(row.id)}>
                          <X className='h-3.5 w-3.5' />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add action button / dropdown */}
                {addingAction ? (
                  <div className='flex flex-wrap gap-1.5'>
                    {availableActionTypes.map((type) => (
                      <Button
                        key={type}
                        type='button'
                        variant='outline'
                        size='sm'
                        className='h-7 cursor-pointer text-xs'
                        onClick={(): void => addAction(type)}>
                        {t(ACTION_TYPE_KEYS[type])}
                      </Button>
                    ))}
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-7 cursor-pointer text-xs'
                      onClick={(): void => setAddingAction(false)}>
                      {tCommon('cancel')}
                    </Button>
                  </div>
                ) : (
                  availableActionTypes.length > 0 && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-8 w-full cursor-pointer text-xs'
                      onClick={(): void => setAddingAction(true)}>
                      <Plus className='mr-1.5 h-3 w-3' />
                      {t('addAction')}
                    </Button>
                  )
                )}
              </div>

              {/* ── FAQ link ─────────────────────────────────────────── */}
              {appSettings?.automation_faq_url && (
                <a
                  href={appSettings.automation_faq_url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary text-xs hover:underline'>
                  {t('automationFaqLink')}
                </a>
              )}

              {/* ── Submit ──────────────────────────────────────────── */}
              <div className='flex justify-end gap-3 pt-4'>
                <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                  {tCommon('cancel')}
                </Button>
                <Button
                  type='submit'
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? tCommon('saving')
                    : isEditing
                      ? tCommon('update')
                      : tCommon('create')}
                </Button>
              </div>
            </form>
          </Form>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
