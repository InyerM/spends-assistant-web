'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DocumentReviewFields } from '@/components/documents/document-review-fields';
import {
  DocumentAccountSelect,
  DocumentRejectReasonSelect,
} from '@/components/documents/document-review-selects';
import {
  decideDocumentObservation,
  recoverDocumentTransaction,
  reviseDocumentObservation,
  suggestDocumentCategoryWithAi,
} from '@/lib/api/mutations/document.mutations';
import type { DocumentSuggestionGroup } from '@/lib/api/queries/document.queries';
import { createTransaction, DuplicateError } from '@/lib/api/mutations/transaction.mutations';
import {
  suggestDocumentReview,
  inferAccountFromEvidence,
  validateDocumentDraft,
  type ApprovalDraft,
  type ReviewHistoryObservation,
} from '@/lib/document-review';
import type { Account, Category, Transaction } from '@/types';

export interface DocumentReviewRow extends ReviewHistoryObservation {
  ordinal: number;
  amount: number | null;
  occurred_at_text: string | null;
  status: string;
  confidence: number;
}

interface ReviewDraft extends ApprovalDraft {
  categoryId: string;
  sourceExcerpt: string;
  originalAmount: number;
  originalCurrency: string | null;
  originalDateTime: string | null;
  originalDescription: string;
  suggested: boolean;
  learned: boolean;
}

interface Props {
  documentId: string;
  rows: DocumentReviewRow[];
  history: ReviewHistoryObservation[];
  accounts: Account[];
  categories: Category[];
  onRefresh: () => Promise<void>;
  suggestions?: DocumentSuggestionGroup[];
}

export function DocumentBatchReview({
  documentId,
  rows,
  history,
  accounts,
  categories,
  onRefresh,
  suggestions = [],
}: Props): React.ReactElement | null {
  const t = useTranslations('documents');
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [bulkAccount, setBulkAccount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [rejectConfirmation, setRejectConfirmation] = useState(false);
  const [rejectReason, setRejectReason] = useState('other');
  const [rowRejectReasons, setRowRejectReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Record<string, Transaction>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiHints, setAiHints] = useState<Record<string, string>>({});
  const createdIds = useRef<Record<string, string>>({});
  const decisionKeys = useRef<Record<string, string>>({});
  const correctedFingerprints = useRef<Record<string, string>>({});

  const pending = useMemo(() => rows.filter((row) => row.status === 'pending'), [rows]);
  const chosen = useMemo(
    () => pending.filter((row) => selected.includes(row.id)),
    [pending, selected],
  );
  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_active && !account.deleted_at && account.currency === 'COP',
      ),
    [accounts],
  );
  const sharedCurrency = useMemo(() => {
    const currencies = [
      ...new Set(
        accounts
          .filter((account) => account.is_active && !account.deleted_at)
          .map((account) => account.currency),
      ),
    ];
    return currencies.length === 1 ? currencies[0] : null;
  }, [accounts]);

  if (pending.length === 0) return null;

  const draftFor = (row: DocumentReviewRow): ReviewDraft => {
    const suggestion = suggestDocumentReview(row, history, sharedCurrency);
    const inferredType = row.amount !== null && row.amount > 0 ? 'income' : 'expense';
    const type =
      suggestion.transaction?.type === 'expense' ||
      suggestion.transaction?.type === 'income' ||
      suggestion.transaction?.type === 'transfer'
        ? suggestion.transaction.type
        : inferredType;
    const preferredCurrency = suggestion.currency?.value ?? row.currency ?? 'COP';
    const evidenceAccount = inferAccountFromEvidence(row.source_excerpt, accounts);
    const suggestedAccount = accounts.find(
      (account) =>
        account.id === evidenceAccount?.accountId &&
        account.is_active &&
        !account.deleted_at &&
        account.currency === preferredCurrency,
    );
    const occurred = row.occurred_at_text ?? '';
    return {
      amount: row.amount === null ? '' : String(Math.abs(row.amount)),
      currency: preferredCurrency,
      date: /^\d{4}-\d{2}-\d{2}/.test(occurred) ? occurred.slice(0, 10) : '',
      time: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(occurred) ? occurred.slice(11, 16) : '',
      description: row.description,
      type,
      accountId: suggestedAccount?.id ?? bulkAccount,
      destinationAccountId: '',
      categoryId: ((): string => {
        const proposed = suggestions.find(
          (group) => group.observation_id === row.id,
        )?.category_suggestion;
        return proposed &&
          categories.some(
            (category) =>
              category.id === proposed.categoryId && category.is_active && category.type === type,
          )
          ? proposed.categoryId
          : (suggestion.transaction?.categoryId ?? '');
      })(),
      sourceExcerpt: row.source_excerpt,
      originalAmount: row.amount ?? 0,
      originalCurrency: row.currency,
      originalDateTime: row.occurred_at_text,
      originalDescription: row.description,
      suggested: suggestion.currency !== null,
      learned:
        suggestion.transaction !== null ||
        suggestions.some((group) => group.observation_id === row.id && !!group.category_suggestion),
    };
  };

  const toggle = (row: DocumentReviewRow): void => {
    setSelected((current) =>
      current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id],
    );
    setDrafts((current) =>
      Object.hasOwn(current, row.id) ? current : { ...current, [row.id]: draftFor(row) },
    );
    setConfirmed(false);
    setRejectConfirmation(false);
  };

  const selectAll = (): void => {
    const allSelected = pending.every((row) => selected.includes(row.id));
    setSelected(allSelected ? [] : pending.map((row) => row.id));
    if (!allSelected)
      setDrafts((current) =>
        Object.fromEntries(pending.map((row) => [row.id, current[row.id] ?? draftFor(row)])),
      );
    setConfirmed(false);
    setRejectConfirmation(false);
  };

  const updateDraft = (id: string, patch: Partial<ReviewDraft>): void => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
    setConfirmed(false);
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
  };

  const selectAccount = (accountId: string): void => {
    setBulkAccount(accountId);
    setDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, draft]) => [id, { ...draft, accountId }]),
      ),
    );
    setConfirmed(false);
  };

  const suggestCategoryWithAi = async (row: DocumentReviewRow): Promise<void> => {
    const draft = drafts[row.id];
    if (draft.type !== 'expense' || draft.currency !== 'COP' || aiBusy) return;
    setAiBusy(row.id);
    setErrors((current) => ({ ...current, [row.id]: '' }));
    try {
      const text = `Expense at ${draft.description} for COP ${draft.amount} on ${draft.date}. Original notification: ${row.source_excerpt.slice(0, 500)}`;
      const categoryId = await suggestDocumentCategoryWithAi(text);
      const category = categories.find(
        (item) => item.id === categoryId && item.type === 'expense' && item.is_active,
      );
      if (!category) {
        setErrors((current) => ({ ...current, [row.id]: t('aiCategoryUnavailable') }));
        return;
      }
      updateDraft(row.id, { categoryId: category.id });
      setAiHints((current) => ({ ...current, [row.id]: category.name }));
    } catch (cause) {
      setErrors((current) => ({
        ...current,
        [row.id]: cause instanceof Error ? cause.message : t('aiCategoryFailed'),
      }));
    } finally {
      setAiBusy(null);
    }
  };

  const decide = async (
    observationId: string,
    action: 'accept' | 'reject_observation',
    transactionId?: string,
    reason?: string,
  ): Promise<void> => {
    decisionKeys.current[observationId] ??= crypto.randomUUID();
    await decideDocumentObservation({
      documentId,
      observationId,
      action,
      transactionId,
      reason,
      key: decisionKeys.current[observationId],
    });
  };

  const approve = async (): Promise<void> => {
    if (!confirmed || busy || chosen.length === 0) return;
    const invalid = chosen.find(
      (row) => validateDocumentDraft(drafts[row.id], accounts).length > 0,
    );
    if (invalid) {
      const fields = validateDocumentDraft(drafts[invalid.id], accounts);
      setErrors((current) => ({
        ...current,
        [invalid.id]: fields.includes('currency')
          ? t('reviewCurrencyRequired')
          : t('reviewFieldsRequired'),
      }));
      return;
    }
    setBusy(true);
    let completed = 0;
    const nextErrors: Record<string, string> = {};
    const done: string[] = [];
    for (const row of chosen) {
      const draft = drafts[row.id];
      setProgress(t('reviewProgress', { current: completed + 1, total: chosen.length }));
      try {
        const signedAmount = draft.type === 'income' ? Number(draft.amount) : -Number(draft.amount);
        const occurredAt = `${draft.date}${draft.time ? `T${draft.time}` : ''}`;
        const correctionBody = {
          amount: signedAmount,
          currency: draft.currency || null,
          occurred_at_text: occurredAt,
          description: draft.description.trim(),
        };
        const correctionFingerprint = JSON.stringify(correctionBody);
        if (
          correctedFingerprints.current[row.id] !== correctionFingerprint &&
          (signedAmount !== draft.originalAmount ||
            draft.currency !== draft.originalCurrency ||
            occurredAt !== draft.originalDateTime ||
            draft.description.trim() !== draft.originalDescription)
        ) {
          await reviseDocumentObservation(documentId, row.id, correctionBody);
          correctedFingerprints.current[row.id] = correctionFingerprint;
        }
        let transactionId: string | undefined = createdIds.current[row.id];
        if (!transactionId) {
          transactionId = (await recoverDocumentTransaction(documentId, row.id)) ?? undefined;
        }
        if (!transactionId) {
          const transaction = await createTransaction({
            date: draft.date,
            time: draft.time || '00:00',
            amount: Number(draft.amount),
            description: draft.description.trim(),
            type: draft.type,
            account_id: draft.accountId,
            transfer_to_account_id:
              draft.type === 'transfer' ? draft.destinationAccountId : undefined,
            category_id: draft.type === 'transfer' ? undefined : draft.categoryId || undefined,
            source: 'web-document',
            raw_text: draft.sourceExcerpt,
            parsed_data: {
              document_id: documentId,
              observation_id: row.id,
              time_source: draft.time ? 'image' : 'unknown',
            },
          });
          transactionId = transaction.id;
        }
        createdIds.current[row.id] = transactionId;
        await decide(row.id, 'accept', transactionId);
        done.push(row.id);
        completed += 1;
      } catch (cause) {
        if (cause instanceof DuplicateError) {
          setDuplicates((current) => ({ ...current, [row.id]: cause.match }));
          nextErrors[row.id] = t('duplicateFound');
        } else nextErrors[row.id] = cause instanceof Error ? cause.message : t('createFailed');
      }
    }
    setErrors(nextErrors);
    setSelected((current) => current.filter((id) => !done.includes(id)));
    setConfirmed(false);
    setBusy(false);
    setProgress(t('reviewResult', { completed, total: chosen.length }));
    await onRefresh();
  };

  const rejectRows = async (targetRows: DocumentReviewRow[], reason: string): Promise<void> => {
    if (busy || targetRows.length === 0) return;
    setBusy(true);
    const nextErrors: Record<string, string> = {};
    const done: string[] = [];
    for (const row of targetRows) {
      try {
        await decide(row.id, 'reject_observation', undefined, reason);
        done.push(row.id);
      } catch (cause) {
        nextErrors[row.id] = cause instanceof Error ? cause.message : t('decisionFailed');
      }
    }
    setErrors(nextErrors);
    setSelected((current) => current.filter((id) => !done.includes(id)));
    setRejectConfirmation(false);
    setBusy(false);
    setProgress(t('reviewResult', { completed: done.length, total: targetRows.length }));
    await onRefresh();
  };

  return (
    <section className='space-y-3' aria-label={t('batchReview')}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h4 className='text-sm font-semibold'>{t('pendingGroup', { count: pending.length })}</h4>
          <p className='text-muted-foreground text-xs'>{t('batchHint')}</p>
        </div>
        <Button
          size='sm'
          variant='outline'
          disabled={busy}
          onClick={selectAll}
          aria-label={t('selectAllPending')}>
          {pending.every((row) => selected.includes(row.id))
            ? t('clearSelection')
            : t('selectAllPending')}
        </Button>
      </div>
      <div className='space-y-2'>
        {pending.map((row) => {
          const draft = drafts[row.id];
          const suggestion = suggestDocumentReview(row, history, sharedCurrency);
          const reviewHint = suggestions.find((group) => group.observation_id === row.id);
          const proposedCategory = reviewHint?.category_suggestion;
          const historicalCategory =
            proposedCategory &&
            (row.amount === null ||
              (row.amount > 0
                ? proposedCategory.type === 'income'
                : proposedCategory.type !== 'income')) &&
            categories.some(
              (category) =>
                category.id === proposedCategory.categoryId &&
                category.is_active &&
                category.type === proposedCategory.type,
            )
              ? proposedCategory
              : null;
          const accountEvidence = inferAccountFromEvidence(row.source_excerpt, accounts);
          const evidencedAccountName = accounts.find(
            (account) => account.id === accountEvidence?.accountId,
          )?.name;
          return (
            <article
              key={row.id}
              className='border-border bg-muted/20 rounded-lg border p-3 sm:p-4'>
              <div className='flex items-start gap-3'>
                <Checkbox
                  className='mt-1 size-5 shrink-0'
                  aria-label={t('selectObservation', { description: row.description })}
                  checked={selected.includes(row.id)}
                  disabled={busy}
                  onCheckedChange={() => toggle(row)}
                />
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <h5 className='font-medium break-words'>{row.description}</h5>
                      <p className='text-muted-foreground text-xs'>
                        {row.occurred_at_text ?? t('dateUnknown')}
                      </p>
                    </div>
                    <strong className='whitespace-nowrap tabular-nums'>
                      {row.amount === null
                        ? t('amountUnknown')
                        : `${suggestion.currency?.value ?? row.currency ?? 'COP'} ${row.amount.toLocaleString()}`}
                    </strong>
                  </div>
                  {suggestion.currency && (
                    <p className='mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300'>
                      <AlertCircle className='size-3.5' aria-hidden='true' />
                      {t('currencySuggestion', { currency: suggestion.currency.value })}
                    </p>
                  )}
                  {evidencedAccountName && (
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {t('accountEvidenceHint', { name: evidencedAccountName })}
                    </p>
                  )}
                  {suggestion.previouslyRejected && (
                    <p className='mt-1 text-xs text-amber-700 dark:text-amber-300'>
                      {t('previouslyRejectedHint')}
                    </p>
                  )}
                  {reviewHint?.candidates.map((candidate) => (
                    <p
                      key={candidate.transaction_id}
                      className='mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs'>
                      {t('possibleDuplicate', {
                        description: candidate.description,
                        date: candidate.date,
                      })}{' '}
                      <Link
                        className='text-primary underline'
                        href={`/transactions/${candidate.transaction_id}`}>
                        {t('reviewExistingTransaction')}
                      </Link>
                    </p>
                  ))}
                  {historicalCategory && (
                    <div className='mt-2 flex flex-wrap items-center gap-2'>
                      <p className='text-muted-foreground text-xs'>
                        {t('categoryHistoryHint', {
                          name:
                            categories.find(
                              (category) => category.id === historicalCategory.categoryId,
                            )?.name ?? t('selectCategory'),
                          count: historicalCategory.evidenceCount,
                        })}
                      </p>
                      {selected.includes(row.id) &&
                        draft.categoryId !== historicalCategory.categoryId && (
                          <Button
                            size='sm'
                            variant='outline'
                            disabled={busy}
                            onClick={() =>
                              updateDraft(row.id, {
                                categoryId: historicalCategory.categoryId,
                                type: historicalCategory.type as ReviewDraft['type'],
                              })
                            }>
                            {t('applyCategorySuggestion')}
                          </Button>
                        )}
                    </div>
                  )}
                  {selected.includes(row.id) &&
                    draft.type === 'expense' &&
                    draft.currency === 'COP' && (
                      <div className='mt-2 flex flex-wrap items-center gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={busy || !!aiBusy}
                          onClick={() => void suggestCategoryWithAi(row)}>
                          {aiBusy === row.id
                            ? t('suggestingCategoryWithAi')
                            : t('suggestCategoryWithAi')}
                        </Button>
                        {aiHints[row.id] && (
                          <p className='text-muted-foreground text-xs'>
                            {t('aiCategoryHint', { name: aiHints[row.id] })}
                          </p>
                        )}
                      </div>
                    )}
                  {errors[row.id] && (
                    <p role='alert' className='text-destructive mt-2 text-xs'>
                      {errors[row.id]}
                    </p>
                  )}
                  {Object.hasOwn(duplicates, row.id) && (
                    <Link
                      className='text-primary mt-2 inline-block text-xs underline'
                      href={`/transactions/${duplicates[row.id].id}`}>
                      {t('reviewExistingTransaction')}
                    </Link>
                  )}
                  {Object.hasOwn(drafts, row.id) && selected.includes(row.id) && (
                    <details
                      className='mt-3 border-t pt-3'
                      open={chosen.length === 1 ? true : undefined}>
                      <summary className='text-primary flex cursor-pointer items-center gap-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2'>
                        <ChevronDown className='size-4' aria-hidden='true' />
                        {t('editObservation')}
                      </summary>
                      <DocumentReviewFields
                        draft={draft}
                        accounts={accounts}
                        categories={categories}
                        disabled={busy || !!createdIds.current[row.id]}
                        onChange={(patch) => updateDraft(row.id, patch)}
                      />
                      {draft.learned && (
                        <p className='text-muted-foreground mt-2 text-xs'>
                          {t('learnedSuggestion')}
                        </p>
                      )}
                      <p className='text-muted-foreground mt-2 border-l-2 pl-2 text-xs'>
                        {row.source_excerpt}
                      </p>
                    </details>
                  )}
                  <div className='mt-3 flex flex-wrap items-center gap-2 border-t pt-3'>
                    <DocumentRejectReasonSelect
                      value={rowRejectReasons[row.id] ?? 'other'}
                      disabled={busy}
                      onChange={(reason) =>
                        setRowRejectReasons((current) => ({ ...current, [row.id]: reason }))
                      }
                    />
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={busy}
                      onClick={() => void rejectRows([row], rowRejectReasons[row.id] ?? 'other')}>
                      {t('reviewReject')}
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {chosen.length > 0 && (
        <div className='border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-4'>
          <p className='font-semibold'>{t('selectedCount', { count: chosen.length })}</p>
          <div className='space-y-1 text-sm'>
            <label>{t('bulkAccount')}</label>
            <DocumentAccountSelect
              value={bulkAccount}
              accounts={activeAccounts}
              disabled={busy}
              label={t('bulkAccount')}
              onChange={selectAccount}
            />
          </div>
          <p className='text-muted-foreground text-xs'>{t('batchReviewWarning')}</p>
          <label className='flex items-start gap-2 text-sm'>
            <Checkbox
              className='mt-1'
              aria-label={t('confirmSelected')}
              checked={confirmed}
              disabled={busy}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            {t('confirmSelected')}
          </label>
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' disabled={busy || !confirmed} onClick={() => void approve()}>
              <Check className='size-4' aria-hidden='true' />
              {t('approveSelected')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={busy}
              onClick={() => setRejectConfirmation(true)}>
              {t('rejectSelected')}
            </Button>
          </div>
          {rejectConfirmation && (
            <div
              role='region'
              aria-label={t('bulkRejectConfirmation')}
              className='border-destructive/30 rounded-md border p-3 text-sm'>
              <p>{t('confirmRejectSelectedHint', { count: chosen.length })}</p>
              <div className='mt-3'>
                <DocumentRejectReasonSelect
                  value={rejectReason}
                  disabled={busy}
                  onChange={setRejectReason}
                />
              </div>
              <div className='mt-3 flex gap-2'>
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={busy}
                  onClick={() => void rejectRows(chosen, rejectReason)}>
                  {t('confirmRejectSelected')}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={busy}
                  onClick={() => setRejectConfirmation(false)}>
                  {t('cancelReview')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {progress && (
        <p role='status' className='text-muted-foreground text-sm'>
          {progress}
        </p>
      )}
    </section>
  );
}
