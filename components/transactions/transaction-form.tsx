'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, AlertTriangle, Loader2, Pencil, Zap } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useResolveDuplicate,
  DuplicateError,
} from '@/lib/api/mutations/transaction.mutations';
import { DuplicateWarningDialog } from '@/components/transactions/duplicate-warning-dialog';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import { UsageIndicator } from '@/components/shared/usage-indicator';
import { useUsage } from '@/hooks/use-usage';
import { useSubscription } from '@/hooks/use-subscription';
import type { AppliedRule, Transaction, CreateTransactionInput } from '@/types';

// --- AI Parse types ---

interface ParsedExpense {
  amount: number;
  description: string;
  category: string;
  original_date?: string | null;
  original_time?: string | null;
  confidence: number;
  payment_type?: string;
  bank?: string;
  type?: string;
}

interface ParseResponse {
  parsed: ParsedExpense;
  resolved: {
    account_id?: string;
    category_id?: string;
    transfer_to_account_id?: string;
    transfer_id?: string;
    type?: string;
    notes?: string;
  };
  original?: {
    account_id?: string;
    category_id?: string;
  };
  applied_rules: AppliedRule[];
}

function parseDateString(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  let year = parts[2];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function parseTimeString(timeStr: string): string {
  return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
}

function findCategoryName(cats: { id: string; name: string }[], id: string): string | null {
  return cats.find((c) => c.id === id)?.name ?? null;
}

const SKIPPED_REASON_KEYS: Record<string, string> = {
  spending_summary: 'skippedSpendingSummary',
  balance_inquiry: 'skippedBalanceInquiry',
  otp_code: 'skippedOtpCode',
  promotional: 'skippedPromotional',
  informational: 'skippedInformational',
};

// --- Form schema ---

const formSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
  type: z.enum(['expense', 'income', 'transfer']),
  account_id: z.string().min(1, 'Account is required'),
  category_id: z.string().optional(),
  transfer_to_account_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Step = 'ai-prompt' | 'ai-result' | 'form';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
}: TransactionFormProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: usage } = useUsage();
  const { data: subscription } = useSubscription();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const deleteMutation = useDeleteTransaction();
  const resolveDuplicate = useResolveDuplicate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const addAnotherRef = useRef(false);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    match: Transaction;
    input: CreateTransactionInput;
  } | null>(null);

  // AI prompt state
  const [step, setStep] = useState<Step>('ai-prompt');
  const [aiText, setAiText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<{
    raw_text: string;
    confidence: number;
    parsed_data: Record<string, unknown>;
    applied_rules?: AppliedRule[];
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const colombiaTimes = getCurrentColombiaTimes();
  const isEditing = !!transaction?.id;
  const isPro = subscription?.plan === 'pro';
  const atLimit = usage ? usage.ai_parses_used >= usage.ai_parses_limit : false;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: colombiaTimes.date,
      time: colombiaTimes.time,
      amount: 0,
      description: '',
      notes: '',
      type: 'expense' as const,
      account_id: '',
      category_id: undefined,
      transfer_to_account_id: undefined,
    },
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && transaction) {
      // Edit mode: go straight to form
      form.reset({
        date: transaction.date,
        time: transaction.time,
        amount: transaction.amount,
        description: transaction.description,
        notes: transaction.notes ?? '',
        type: transaction.type,
        account_id: transaction.account_id,
        category_id: transaction.category_id ?? undefined,
        transfer_to_account_id: transaction.transfer_to_account_id ?? undefined,
      });
      setStep('form');
      setAiSource(null);
      setParseResult(null);
    } else if (open && !transaction) {
      // New: start at AI prompt
      const times = getCurrentColombiaTimes();
      form.reset({
        date: times.date,
        time: times.time,
        amount: 0,
        description: '',
        notes: '',
        type: 'expense',
        account_id: '',
        category_id: undefined,
        transfer_to_account_id: undefined,
      });
      setStep('ai-prompt');
      setAiText('');
      setParseResult(null);
      setLimitReached(false);
      setSkippedReason(null);
      setAiSource(null);
    }
  }, [open, transaction, form]);

  const watchType = form.watch('type');

  // --- AI Parse logic ---

  async function handleParse(): Promise<void> {
    if (!aiText.trim()) return;
    setParsing(true);
    setParseResult(null);
    setLimitReached(false);
    setSkippedReason(null);
    try {
      const res = await fetch('/api/transactions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Parse failed' }));
        const errObj = err as { error: string; code?: string };
        if (res.status === 429 && errObj.code === 'PARSE_LIMIT_REACHED') {
          setLimitReached(true);
          return;
        }
        throw new Error(errObj.error);
      }
      const data = (await res.json()) as ParseResponse & { status?: string; reason?: string };
      if (data.status === 'skipped') {
        setSkippedReason(data.reason ?? 'unknown');
        return;
      }
      setParseResult(data);
      setStep('ai-result');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse');
    } finally {
      setParsing(false);
    }
  }

  function buildFieldsFromParse(result: ParseResponse): FormValues {
    const { parsed, resolved } = result;
    const times = getCurrentColombiaTimes();
    const date = parsed.original_date ? parseDateString(parsed.original_date) : times.date;
    const time = parsed.original_time ? parseTimeString(parsed.original_time) : times.time;
    const type = (resolved.type ?? parsed.type ?? 'expense') as 'expense' | 'income' | 'transfer';

    return {
      date,
      time,
      amount: parsed.amount,
      description: parsed.description,
      type,
      account_id: resolved.account_id ?? '',
      category_id: resolved.category_id,
      transfer_to_account_id: resolved.transfer_to_account_id,
      notes: resolved.notes ?? '',
    };
  }

  function handleQuickCreate(): void {
    if (!parseResult) return;
    const fields = buildFieldsFromParse(parseResult);
    setAiSource({
      raw_text: aiText,
      confidence: parseResult.parsed.confidence,
      parsed_data: parseResult.parsed as unknown as Record<string, unknown>,
      applied_rules: parseResult.applied_rules.length > 0 ? parseResult.applied_rules : undefined,
    });
    form.reset(fields);
    // Submit directly
    void quickSubmit(fields);
  }

  async function quickSubmit(fields: FormValues): Promise<void> {
    try {
      await createMutation.mutateAsync({
        ...fields,
        source: 'web-ai',
        raw_text: aiText,
        confidence: parseResult?.parsed.confidence,
        parsed_data: parseResult?.parsed as unknown as Record<string, unknown>,
        applied_rules:
          parseResult && parseResult.applied_rules.length > 0
            ? parseResult.applied_rules
            : undefined,
        category_id: fields.category_id ?? undefined,
        transfer_to_account_id: fields.transfer_to_account_id ?? undefined,
      });
      toast.success(t('transactionCreatedFromAi'));
      onOpenChange(false);
    } catch (err) {
      if (err instanceof DuplicateError) {
        setDuplicateConflict({ match: err.match, input: err.input });
        return;
      }
      toast.error(t('failedToCreate'));
    }
  }

  function handleQuickCreateAndAnother(): void {
    if (!parseResult) return;
    const fields = buildFieldsFromParse(parseResult);
    void quickSubmitAndAnother(fields);
  }

  async function quickSubmitAndAnother(fields: FormValues): Promise<void> {
    try {
      await createMutation.mutateAsync({
        ...fields,
        source: 'web-ai',
        raw_text: aiText,
        confidence: parseResult?.parsed.confidence,
        parsed_data: parseResult?.parsed as unknown as Record<string, unknown>,
        applied_rules:
          parseResult && parseResult.applied_rules.length > 0
            ? parseResult.applied_rules
            : undefined,
        category_id: fields.category_id ?? undefined,
        transfer_to_account_id: fields.transfer_to_account_id ?? undefined,
      });
      toast.success(t('transactionCreatedFromAi'));
      // Reset for next parse
      setAiText('');
      setParseResult(null);
      setStep('ai-prompt');
    } catch (err) {
      if (err instanceof DuplicateError) {
        setDuplicateConflict({ match: err.match, input: err.input });
        return;
      }
      toast.error(t('failedToCreate'));
    }
  }

  function handleEditInForm(): void {
    if (!parseResult) return;
    const fields = buildFieldsFromParse(parseResult);
    setAiSource({
      raw_text: aiText,
      confidence: parseResult.parsed.confidence,
      parsed_data: parseResult.parsed as unknown as Record<string, unknown>,
      applied_rules: parseResult.applied_rules.length > 0 ? parseResult.applied_rules : undefined,
    });
    form.reset(fields);
    setStep('form');
  }

  function handleCreateManually(): void {
    setAiSource(null);
    setParseResult(null);
    setStep('form');
  }

  // --- Form submit ---

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: transaction.id,
          ...values,
          source: transaction.source,
          category_id: values.category_id ?? undefined,
          transfer_to_account_id: values.transfer_to_account_id ?? undefined,
        });
        toast.success(t('transactionUpdated'));
        onOpenChange(false);
      } else {
        await createMutation.mutateAsync({
          ...values,
          source: aiSource ? 'web-ai' : 'web',
          category_id: values.category_id ?? undefined,
          transfer_to_account_id: values.transfer_to_account_id ?? undefined,
          ...(aiSource
            ? {
                raw_text: aiSource.raw_text,
                confidence: aiSource.confidence,
                parsed_data: aiSource.parsed_data,
                applied_rules: aiSource.applied_rules,
              }
            : {}),
        });
        toast.success(t('transactionCreated'));
        if (addAnotherRef.current) {
          const times = getCurrentColombiaTimes();
          form.reset({
            date: times.date,
            time: times.time,
            amount: 0,
            description: '',
            notes: '',
            type: values.type,
            account_id: values.account_id,
            category_id: values.category_id,
            transfer_to_account_id: undefined,
          });
          setAiSource(null);
          return;
        }
        onOpenChange(false);
      }
      form.reset();
    } catch (err) {
      if (err instanceof DuplicateError) {
        setDuplicateConflict({ match: err.match, input: err.input });
        return;
      }
      toast.error(isEditing ? t('failedToUpdate') : t('failedToCreate'));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!transaction) return;
    try {
      await deleteMutation.mutateAsync(transaction.id);
      toast.success(t('transactionDeleted'));
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error(t('failedToDelete'));
    }
  }

  const allCategories = categories ?? [];

  // --- AI result display helpers ---
  const hasRules = parseResult && parseResult.applied_rules.length > 0;
  const resolvedType = parseResult?.resolved.type ?? parseResult?.parsed.type;
  const resolvedCategoryName = parseResult?.resolved.category_id
    ? findCategoryName(categories ?? [], parseResult.resolved.category_id)
    : null;
  const resolvedAccountName = parseResult?.resolved.transfer_to_account_id
    ? accounts?.find((a) => a.id === parseResult.resolved.transfer_to_account_id)?.name
    : null;
  const sourceAccountName = parseResult?.resolved.account_id
    ? accounts?.find((a) => a.id === parseResult.resolved.account_id)?.name
    : null;
  const categoryOverridden =
    hasRules &&
    parseResult.original?.category_id !== undefined &&
    parseResult.original.category_id !== parseResult.resolved.category_id;
  const accountOverridden =
    hasRules &&
    parseResult.original?.account_id !== undefined &&
    parseResult.original.account_id !== parseResult.resolved.account_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('editTransaction')
              : step === 'ai-result'
                ? t('aiTransaction')
                : t('newTransaction')}
          </DialogTitle>
          {step === 'ai-prompt' && !isEditing && (
            <p className='text-muted-foreground text-sm'>{t('aiDialogDescription')}</p>
          )}
        </DialogHeader>

        {/* ========== STEP: AI PROMPT ========== */}
        {step === 'ai-prompt' && !isEditing && (
          <div className='space-y-4'>
            {!isPro && usage && <UsageIndicator usage={usage} />}

            {!isPro && atLimit ? (
              /* At limit: show error + create manually as primary */
              <div className='space-y-3'>
                <div className='border-destructive/30 bg-destructive/5 flex items-center justify-between rounded-lg border p-3'>
                  <p className='text-destructive text-sm font-medium'>{t('aiParseLimitBanner')}</p>
                  <a
                    href='/settings?tab=subscription'
                    className='text-primary text-xs font-medium whitespace-nowrap hover:underline'>
                    {tCommon('upgrade')} &rarr;
                  </a>
                </div>
                <Button
                  className='w-full cursor-pointer'
                  variant='outline'
                  onClick={handleCreateManually}>
                  {t('orCreateManually')}
                </Button>
              </div>
            ) : (
              /* Normal: textarea + parse button + create manually link */
              <>
                <Textarea
                  ref={textareaRef}
                  placeholder={t('aiTextPlaceholder')}
                  value={aiText}
                  onChange={(e): void => setAiText(e.target.value)}
                  rows={3}
                  disabled={parsing}
                />

                {limitReached && (
                  <div className='border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-4'>
                    <p className='text-destructive text-sm font-medium'>{t('parseLimitReached')}</p>
                    <p className='text-muted-foreground text-xs'>{t('parseLimitDescription')}</p>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        className='flex-1 cursor-pointer'
                        onClick={handleCreateManually}>
                        {t('orCreateManually')}
                      </Button>
                      <a href='/settings?tab=subscription' className='flex-1'>
                        <Button className='w-full cursor-pointer'>{t('viewSubscription')}</Button>
                      </a>
                    </div>
                  </div>
                )}

                {skippedReason && (
                  <div className='border-warning/30 bg-warning/5 space-y-3 rounded-lg border p-4'>
                    <div className='flex items-center gap-2'>
                      <AlertTriangle className='text-warning h-5 w-5 shrink-0' />
                      <p className='text-sm font-medium'>{t('notTransaction')}</p>
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      {SKIPPED_REASON_KEYS[skippedReason]
                        ? t(SKIPPED_REASON_KEYS[skippedReason])
                        : `Reason: ${skippedReason}`}
                    </p>
                    <Button
                      variant='outline'
                      className='w-full cursor-pointer'
                      onClick={(): void => {
                        setSkippedReason(null);
                        setAiText('');
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}>
                      {tCommon('tryAgain')}
                    </Button>
                  </div>
                )}

                {!limitReached && !skippedReason && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='w-full'>
                            <Button
                              onClick={handleParse}
                              disabled={parsing || !aiText.trim()}
                              className='ai-gradient-btn w-full cursor-pointer'>
                              {parsing ? (
                                <>
                                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                  {t('parsing')}
                                </>
                              ) : (
                                <>
                                  <Sparkles className='mr-2 h-4 w-4' />
                                  {t('parseWithAi')}
                                </>
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {atLimit && <TooltipContent>{t('limitReachedTooltip')}</TooltipContent>}
                      </Tooltip>
                    </TooltipProvider>
                    <button
                      type='button'
                      className='text-muted-foreground hover:text-foreground w-full cursor-pointer text-center text-sm transition-colors'
                      onClick={handleCreateManually}>
                      {t('orCreateManually')}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ========== STEP: AI RESULT (preview) ========== */}
        {step === 'ai-result' && parseResult && (
          <div className='space-y-3'>
            <div className='border-border space-y-2 rounded-lg border p-3'>
              <div className='grid grid-cols-2 gap-2 text-sm'>
                <div>
                  <span className='text-muted-foreground text-xs'>{t('amount')}</span>
                  <p className='font-semibold'>
                    ${parseResult.parsed.amount.toLocaleString('es-CO')}
                  </p>
                </div>
                <div>
                  <span className='text-muted-foreground text-xs'>{t('confidence')}</span>
                  <p className='font-semibold'>{parseResult.parsed.confidence}%</p>
                </div>
                <div className='col-span-2'>
                  <span className='text-muted-foreground text-xs'>{t('description')}</span>
                  <p className='font-medium'>{parseResult.parsed.description}</p>
                </div>
                <div>
                  <span className='text-muted-foreground text-xs'>{t('category')}</span>
                  {categoryOverridden ? (
                    <div>
                      <p className='text-muted-foreground text-xs line-through'>
                        {parseResult.parsed.category}
                      </p>
                      <p className='flex items-center gap-1'>
                        <Zap className='text-warning h-3 w-3' />
                        {resolvedCategoryName}
                      </p>
                    </div>
                  ) : (
                    <p>{resolvedCategoryName ?? parseResult.parsed.category}</p>
                  )}
                </div>
                {resolvedType && (
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('type')}</span>
                    <p className='capitalize'>{resolvedType}</p>
                  </div>
                )}
                {sourceAccountName && (
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('account')}</span>
                    {accountOverridden ? (
                      <div>
                        <p className='text-muted-foreground text-xs line-through'>
                          {accounts?.find((a) => a.id === parseResult.original?.account_id)?.name ??
                            parseResult.parsed.bank}
                        </p>
                        <p className='flex items-center gap-1'>
                          <Zap className='text-warning h-3 w-3' />
                          {sourceAccountName}
                        </p>
                      </div>
                    ) : (
                      <p>{sourceAccountName}</p>
                    )}
                  </div>
                )}
                {parseResult.parsed.bank && !sourceAccountName && (
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('bank')}</span>
                    <p>{parseResult.parsed.bank}</p>
                  </div>
                )}
                {parseResult.parsed.original_date && (
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('date')}</span>
                    <p>{parseResult.parsed.original_date}</p>
                  </div>
                )}
                {parseResult.parsed.original_time && (
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('time')}</span>
                    <p>{parseResult.parsed.original_time}</p>
                  </div>
                )}
                {parseResult.resolved.notes && (
                  <div className='col-span-2'>
                    <span className='text-muted-foreground text-xs'>{t('notes')}</span>
                    <p className='flex items-center gap-1 text-sm'>
                      <Zap className='text-warning h-3 w-3 shrink-0' />
                      {parseResult.resolved.notes}
                    </p>
                  </div>
                )}
                {resolvedAccountName && (
                  <div className='col-span-2'>
                    <span className='text-muted-foreground text-xs'>{t('transferTo')}</span>
                    <p className='flex items-center gap-1'>
                      <Zap className='text-warning h-3 w-3' />
                      {resolvedAccountName}
                    </p>
                  </div>
                )}
              </div>

              {hasRules && (
                <div className='border-border border-t pt-2'>
                  <div className='mb-1 flex items-center gap-1.5'>
                    <Zap className='text-warning h-3.5 w-3.5' />
                    <span className='text-muted-foreground text-xs font-medium'>
                      {t('automationRulesApplied')}
                    </span>
                  </div>
                  <div className='max-h-[200px] space-y-1 overflow-y-auto'>
                    {parseResult.applied_rules.map((rule) => {
                      const actions = rule.actions as Record<string, string | undefined>;
                      const details: string[] = [];
                      if (actions.set_type) details.push(`type: ${actions.set_type}`);
                      if (actions.set_category) {
                        const name = findCategoryName(categories ?? [], actions.set_category);
                        details.push(`category: ${name ?? actions.set_category}`);
                      }
                      if (actions.set_account) {
                        const name = accounts?.find((a) => a.id === actions.set_account)?.name;
                        details.push(`account: ${name ?? 'account'}`);
                      }
                      if (actions.link_to_account) {
                        const name = accounts?.find((a) => a.id === actions.link_to_account)?.name;
                        details.push(`transfer to: ${name ?? 'account'}`);
                      }
                      if (actions.add_note) {
                        details.push(`note: ${actions.add_note}`);
                      }
                      return (
                        <div key={rule.rule_id}>
                          <Badge variant='secondary' className='text-xs'>
                            {rule.rule_name}
                          </Badge>
                          {details.length > 0 && (
                            <p className='text-muted-foreground mt-0.5 text-xs'>
                              {details.join(' · ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!parseResult.resolved.account_id && (
                <p className='text-destructive text-xs'>{t('noMatchingAccount')}</p>
              )}
            </div>

            <div className='flex flex-col gap-2'>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  className='flex-1 cursor-pointer'
                  onClick={(): void => {
                    setParseResult(null);
                    setStep('ai-prompt');
                  }}>
                  {t('reparse')}
                </Button>
                <Button
                  variant='outline'
                  className='flex-1 cursor-pointer'
                  onClick={handleEditInForm}>
                  <Pencil className='mr-1.5 h-4 w-4' />
                  {t('editAndCreate')}
                </Button>
              </div>
              <div className='flex gap-2'>
                <Button
                  className='flex-1 cursor-pointer'
                  disabled={createMutation.isPending || !parseResult.resolved.account_id}
                  onClick={handleQuickCreate}>
                  {createMutation.isPending ? tCommon('creating') : t('quickCreate')}
                </Button>
                <Button
                  variant='secondary'
                  className='cursor-pointer'
                  disabled={createMutation.isPending || !parseResult.resolved.account_id}
                  onClick={handleQuickCreateAndAnother}>
                  {t('createAndNext')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========== STEP: MANUAL FORM ========== */}
        {step === 'form' && (
          <>
            {!isEditing && !isPro && usage && <UsageIndicator usage={usage} showTransactions />}

            {!isEditing &&
              !isPro &&
              usage &&
              usage.transactions_count >= usage.transactions_limit && (
                <div className='border-destructive/30 bg-destructive/5 flex items-center justify-between rounded-lg border p-3'>
                  <p className='text-destructive text-sm font-medium'>
                    {t('transactionLimitReached')}
                  </p>
                  <a
                    href='/settings?tab=subscription'
                    className='text-primary text-xs font-medium whitespace-nowrap hover:underline'>
                    {tCommon('upgrade')} &rarr;
                  </a>
                </div>
              )}

            {isEditing && transaction.duplicate_status === 'pending_review' && (
              <div className='border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border p-3'>
                <AlertTriangle className='text-warning mt-0.5 h-4 w-4 shrink-0' />
                <div className='flex-1'>
                  <p className='text-sm font-medium'>{t('duplicateWarning')}</p>
                  <p className='text-muted-foreground text-xs'>{t('duplicateFlagged')}</p>
                  <div className='mt-2 flex gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={resolveDuplicate.isPending}
                      onClick={(): void => {
                        resolveDuplicate.mutate(
                          { id: transaction.id, action: 'keep' },
                          {
                            onSuccess: () => {
                              toast.success(t('markedAsNotDuplicate'));
                              onOpenChange(false);
                            },
                          },
                        );
                      }}>
                      {t('keepBoth')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      className='text-destructive'
                      disabled={resolveDuplicate.isPending}
                      onClick={(): void => {
                        resolveDuplicate.mutate(
                          { id: transaction.id, action: 'delete' },
                          {
                            onSuccess: () => {
                              toast.success(t('duplicateDeleted'));
                              onOpenChange(false);
                            },
                          },
                        );
                      }}>
                      {t('deleteThisOne')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {aiSource && (
              <Badge variant='secondary' className='w-fit gap-1.5'>
                <Sparkles className='h-3 w-3' />
                AI-parsed ({aiSource.confidence}%)
              </Badge>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='date'
                    render={({ field }): React.ReactElement => (
                      <FormItem>
                        <FormLabel>{t('date')}</FormLabel>
                        <FormControl>
                          <DatePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='time'
                    render={({ field }): React.ReactElement => (
                      <FormItem>
                        <FormLabel>{t('time')}</FormLabel>
                        <FormControl>
                          <TimePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='type'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>{t('type')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('selectType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='expense'>{t('expense')}</SelectItem>
                          <SelectItem value='income'>{t('income')}</SelectItem>
                          <SelectItem value='transfer'>{t('transfer')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='amount'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>{t('amountCop')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          inputMode='decimal'
                          step='any'
                          min='0'
                          placeholder='0'
                          {...field}
                          onChange={(e): void => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='description'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>{t('description')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('descriptionPlaceholder')}
                          rows={2}
                          className='resize-none sm:min-h-9 sm:py-1'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='account_id'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>{t('account')}</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={t('selectAccount')}
                          searchPlaceholder={t('searchAccounts')}
                          items={buildAccountItems(accounts ?? [])}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchType === 'transfer' && (
                  <FormField
                    control={form.control}
                    name='transfer_to_account_id'
                    render={({ field }): React.ReactElement => (
                      <FormItem>
                        <FormLabel>{t('transferTo')}</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder={t('selectDestAccount')}
                            searchPlaceholder={t('searchAccounts')}
                            items={buildAccountItems(accounts ?? [])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='category_id'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>{t('category')}</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder={t('selectCategory')}
                          searchPlaceholder={t('searchCategories')}
                          items={buildCategoryItems(allCategories, watchType, {
                            locale: locale as 'en' | 'es' | 'pt',
                            allPrefix: (name: string): string => tCommon('allOf', { name }),
                          })}
                          collapsibleGroups
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='notes'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>{t('notes')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('notesPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className={`flex ${isEditing ? 'justify-between' : 'justify-end'} gap-3 pt-4`}>
                  {isEditing && (
                    <Button
                      type='button'
                      variant='ghost'
                      className='text-destructive cursor-pointer'
                      onClick={(): void => setConfirmDeleteOpen(true)}>
                      {tCommon('delete')}
                    </Button>
                  )}
                  {!isEditing && (
                    <label className='flex flex-1 items-center gap-2'>
                      <Checkbox
                        checked={addAnother}
                        onCheckedChange={(checked): void => {
                          const val = checked === true;
                          setAddAnother(val);
                          addAnotherRef.current = val;
                        }}
                      />
                      <span className='text-muted-foreground text-sm'>{t('addAnother')}</span>
                    </label>
                  )}
                  <div className='flex gap-3'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={(): void => onOpenChange(false)}>
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
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>

      {isEditing && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title={t('deleteTransaction')}
          description={
            <p className='text-muted-foreground text-sm'>{tCommon('actionCannotBeUndone')}</p>
          }
          confirmText={t('deleteTransaction')}
          onConfirm={handleDelete}
          isPending={deleteMutation.isPending}
        />
      )}

      {duplicateConflict && (
        <DuplicateWarningDialog
          open={!!duplicateConflict}
          onOpenChange={(o): void => {
            if (!o) setDuplicateConflict(null);
          }}
          existingTransaction={duplicateConflict.match}
          newInput={duplicateConflict.input}
          onResolved={(): void => {
            setDuplicateConflict(null);
            onOpenChange(false);
            form.reset();
          }}
        />
      )}
    </Dialog>
  );
}
