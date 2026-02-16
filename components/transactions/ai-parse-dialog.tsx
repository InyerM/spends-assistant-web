'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2, Sparkles, Pencil, Zap } from 'lucide-react';
import { useCreateTransaction, DuplicateError } from '@/lib/api/mutations/transaction.mutations';
import { DuplicateWarningDialog } from '@/components/transactions/duplicate-warning-dialog';
import { UsageIndicator } from '@/components/shared/usage-indicator';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useUsage } from '@/hooks/use-usage';
import { useSubscription } from '@/hooks/use-subscription';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import type { AppliedRule, CreateTransactionInput, Transaction } from '@/types';

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

function findCategoryName(categories: { id: string; name: string }[], id: string): string | null {
  return categories.find((c) => c.id === id)?.name ?? null;
}

interface AiParseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SKIPPED_REASON_KEYS: Record<string, string> = {
  spending_summary: 'skippedSpendingSummary',
  balance_inquiry: 'skippedBalanceInquiry',
  otp_code: 'skippedOtpCode',
  promotional: 'skippedPromotional',
  informational: 'skippedInformational',
};

export function AiParseDialog({ open, onOpenChange }: AiParseDialogProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const createMutation = useCreateTransaction();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: usage } = useUsage();
  const { data: subscription } = useSubscription();
  const { openWith } = useTransactionFormStore();
  const [duplicateConflict, setDuplicateConflict] = useState<{
    match: Transaction;
    input: CreateTransactionInput;
  } | null>(null);

  function resetState(): void {
    setText('');
    setResult(null);
    setLimitReached(false);
    setSkippedReason(null);
  }

  function handleClose(next: boolean): void {
    if (!next) resetState();
    onOpenChange(next);
  }

  function buildTransactionFields(): {
    date: string;
    time: string;
    amount: number;
    description: string;
    type: string;
    account_id: string;
    category_id: string | undefined;
    payment_method: string | undefined;
    transfer_to_account_id: string | undefined;
    transfer_id: string | undefined;
    notes: string | undefined;
  } | null {
    if (!result) return null;
    const { parsed, resolved } = result;
    const times = getCurrentColombiaTimes();

    const date = parsed.original_date ? parseDateString(parsed.original_date) : times.date;
    const time = parsed.original_time ? parseTimeString(parsed.original_time) : times.time;
    const type = resolved.type ?? parsed.type ?? 'expense';

    return {
      date,
      time,
      amount: parsed.amount,
      description: parsed.description,
      type,
      account_id: resolved.account_id ?? '',
      category_id: resolved.category_id,
      payment_method: parsed.payment_type,
      transfer_to_account_id: resolved.transfer_to_account_id,
      transfer_id: resolved.transfer_id,
      notes: resolved.notes,
    };
  }

  async function handleParse(): Promise<void> {
    if (!text.trim()) return;
    setParsing(true);
    setResult(null);
    setLimitReached(false);
    setSkippedReason(null);
    try {
      const res = await fetch('/api/transactions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
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
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse');
    } finally {
      setParsing(false);
    }
  }

  async function handleQuickCreate(): Promise<void> {
    const fields = buildTransactionFields();
    if (!fields || !result) return;

    try {
      await createMutation.mutateAsync({
        ...fields,
        type: fields.type as 'expense' | 'income' | 'transfer',
        source: 'web-ai',
        raw_text: text,
        confidence: result.parsed.confidence,
        parsed_data: result.parsed as unknown as Record<string, unknown>,
        applied_rules: result.applied_rules.length > 0 ? result.applied_rules : undefined,
      });
      toast.success(t('transactionCreatedFromAi'));
      handleClose(false);
    } catch (err) {
      if (err instanceof DuplicateError) {
        setDuplicateConflict({ match: err.match, input: err.input });
        return;
      }
      toast.error(t('failedToCreate'));
    }
  }

  async function handleQuickCreateAndAnother(): Promise<void> {
    const fields = buildTransactionFields();
    if (!fields || !result) return;

    try {
      await createMutation.mutateAsync({
        ...fields,
        type: fields.type as 'expense' | 'income' | 'transfer',
        source: 'web-ai',
        raw_text: text,
        confidence: result.parsed.confidence,
        parsed_data: result.parsed as unknown as Record<string, unknown>,
        applied_rules: result.applied_rules.length > 0 ? result.applied_rules : undefined,
      });
      toast.success(t('transactionCreatedFromAi'));
      resetState();
    } catch (err) {
      if (err instanceof DuplicateError) {
        setDuplicateConflict({ match: err.match, input: err.input });
        return;
      }
      toast.error(t('failedToCreate'));
    }
  }

  function handleEditInForm(): void {
    const fields = buildTransactionFields();
    if (!fields || !result) return;

    const partial = {
      ...fields,
      notes: fields.notes ?? '',
      source: 'web-ai',
      raw_text: text,
      confidence: result.parsed.confidence,
      parsed_data: result.parsed as unknown as Record<string, unknown>,
      applied_rules: result.applied_rules.length > 0 ? result.applied_rules : undefined,
    } as unknown as Transaction;

    openWith(partial);
    handleClose(false);
  }

  const hasRules = result && result.applied_rules.length > 0;
  const resolvedType = result?.resolved.type ?? result?.parsed.type;

  // Resolve names from UUIDs
  const resolvedCategoryName = result?.resolved.category_id
    ? findCategoryName(categories ?? [], result.resolved.category_id)
    : null;
  const resolvedAccountName = result?.resolved.transfer_to_account_id
    ? accounts?.find((a) => a.id === result.resolved.transfer_to_account_id)?.name
    : null;
  const sourceAccountName = result?.resolved.account_id
    ? accounts?.find((a) => a.id === result.resolved.account_id)?.name
    : null;

  // Check if fields were overridden by automation rules
  const categoryOverridden =
    hasRules &&
    result.original?.category_id !== undefined &&
    result.original.category_id !== result.resolved.category_id;
  const accountOverridden =
    hasRules &&
    result.original?.account_id !== undefined &&
    result.original.account_id !== result.resolved.account_id;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5' />
            {t('aiTransaction')}
          </DialogTitle>
        </DialogHeader>

        {subscription?.plan !== 'pro' && usage && <UsageIndicator usage={usage} />}

        <div className='space-y-4'>
          <div>
            <Textarea
              ref={textareaRef}
              placeholder={t('aiTextPlaceholder')}
              value={text}
              onChange={(e): void => setText(e.target.value)}
              rows={3}
              disabled={parsing}
            />
          </div>

          {limitReached && (
            <div className='border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-4'>
              <p className='text-destructive text-sm font-medium'>{t('parseLimitReached')}</p>
              <p className='text-muted-foreground text-xs'>{t('parseLimitDescription')}</p>
              <Button
                className='w-full cursor-pointer'
                onClick={(): void => {
                  handleClose(false);
                  router.push('/settings?tab=subscription');
                }}>
                {t('viewSubscription')}
              </Button>
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
                  setText('');
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}>
                {tCommon('tryAgain')}
              </Button>
            </div>
          )}

          {!result && !limitReached && !skippedReason && (
            <Button
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className='w-full cursor-pointer'>
              {parsing ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {t('parsing')}
                </>
              ) : (
                t('parseWithAi')
              )}
            </Button>
          )}

          {result && (
            <div className='space-y-3'>
              <div className='border-border space-y-2 rounded-lg border p-3'>
                <div className='grid grid-cols-2 gap-2 text-sm'>
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('amount')}</span>
                    <p className='font-semibold'>${result.parsed.amount.toLocaleString('es-CO')}</p>
                  </div>
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('confidence')}</span>
                    <p className='font-semibold'>{result.parsed.confidence}%</p>
                  </div>
                  <div className='col-span-2'>
                    <span className='text-muted-foreground text-xs'>{t('description')}</span>
                    <p className='font-medium'>{result.parsed.description}</p>
                  </div>
                  <div>
                    <span className='text-muted-foreground text-xs'>{t('category')}</span>
                    {categoryOverridden ? (
                      <div>
                        <p className='text-muted-foreground text-xs line-through'>
                          {result.parsed.category}
                        </p>
                        <p className='flex items-center gap-1'>
                          <Zap className='text-warning h-3 w-3' />
                          {resolvedCategoryName}
                        </p>
                      </div>
                    ) : (
                      <p>{resolvedCategoryName ?? result.parsed.category}</p>
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
                            {accounts?.find((a) => a.id === result.original?.account_id)?.name ??
                              result.parsed.bank}
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
                  {result.parsed.bank && !sourceAccountName && (
                    <div>
                      <span className='text-muted-foreground text-xs'>{t('bank')}</span>
                      <p>{result.parsed.bank}</p>
                    </div>
                  )}
                  {result.parsed.original_date && (
                    <div>
                      <span className='text-muted-foreground text-xs'>{t('date')}</span>
                      <p>{result.parsed.original_date}</p>
                    </div>
                  )}
                  {result.parsed.original_time && (
                    <div>
                      <span className='text-muted-foreground text-xs'>{t('time')}</span>
                      <p>{result.parsed.original_time}</p>
                    </div>
                  )}
                  {result.resolved.notes && (
                    <div className='col-span-2'>
                      <span className='text-muted-foreground text-xs'>{t('notes')}</span>
                      <p className='flex items-center gap-1 text-sm'>
                        <Zap className='text-warning h-3 w-3 shrink-0' />
                        {result.resolved.notes}
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
                      {result.applied_rules.map((rule) => {
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
                          const name = accounts?.find(
                            (a) => a.id === actions.link_to_account,
                          )?.name;
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

                {!result.resolved.account_id && (
                  <p className='text-destructive text-xs'>{t('noMatchingAccount')}</p>
                )}
              </div>

              <div className='flex flex-col gap-2'>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    className='flex-1 cursor-pointer'
                    onClick={(): void => setResult(null)}>
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
                    disabled={createMutation.isPending || !result.resolved.account_id}
                    onClick={handleQuickCreate}>
                    {createMutation.isPending ? tCommon('creating') : t('quickCreate')}
                  </Button>
                  <Button
                    variant='secondary'
                    className='cursor-pointer'
                    disabled={createMutation.isPending || !result.resolved.account_id}
                    onClick={handleQuickCreateAndAnother}>
                    {t('createAndNext')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

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
            handleClose(false);
          }}
        />
      )}
    </Dialog>
  );
}
