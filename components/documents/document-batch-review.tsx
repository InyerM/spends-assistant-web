'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTransaction, DuplicateError } from '@/lib/api/mutations/transaction.mutations';
import {
  suggestDocumentReview,
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
}

async function responseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Review request failed';
}

export function DocumentBatchReview({
  documentId,
  rows,
  history,
  accounts,
  categories,
  onRefresh,
}: Props): React.ReactElement | null {
  const t = useTranslations('documents');
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [bulkAccount, setBulkAccount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [rejectConfirmation, setRejectConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Record<string, Transaction>>({});
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
    const preferredCurrency = suggestion.currency?.value ?? row.currency ?? sharedCurrency ?? '';
    const suggestedAccount = accounts.find(
      (account) =>
        account.id === suggestion.transaction?.accountId &&
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
      categoryId: suggestion.transaction?.categoryId ?? '',
      sourceExcerpt: row.source_excerpt,
      originalAmount: row.amount ?? 0,
      originalCurrency: row.currency,
      originalDateTime: row.occurred_at_text,
      originalDescription: row.description,
      suggested: suggestion.currency !== null,
      learned: suggestion.transaction !== null,
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

  const decide = async (
    observationId: string,
    action: 'accept' | 'reject_observation',
    transactionId?: string,
  ): Promise<void> => {
    decisionKeys.current[observationId] ??= crypto.randomUUID();
    const response = await fetch(`/api/documents/${documentId}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observation_id: observationId,
        action,
        transaction_id: transactionId ?? null,
        idempotency_key: decisionKeys.current[observationId],
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
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
          const correction = await fetch(`/api/documents/${documentId}/observations/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: correctionFingerprint,
          });
          if (!correction.ok) throw new Error(await responseError(correction));
          correctedFingerprints.current[row.id] = correctionFingerprint;
        }
        let transactionId: string | undefined = createdIds.current[row.id];
        if (!transactionId) {
          const recovery = await fetch(`/api/documents/${documentId}/observations/${row.id}`);
          if (!recovery.ok) throw new Error(await responseError(recovery));
          const recovered = (await recovery.json()) as { transaction_id: string | null };
          transactionId = recovered.transaction_id ?? undefined;
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

  const reject = async (): Promise<void> => {
    if (!rejectConfirmation || busy || chosen.length === 0) return;
    setBusy(true);
    const nextErrors: Record<string, string> = {};
    const done: string[] = [];
    for (const row of chosen) {
      try {
        await decide(row.id, 'reject_observation');
        done.push(row.id);
      } catch (cause) {
        nextErrors[row.id] = cause instanceof Error ? cause.message : t('decisionFailed');
      }
    }
    setErrors(nextErrors);
    setSelected((current) => current.filter((id) => !done.includes(id)));
    setRejectConfirmation(false);
    setBusy(false);
    setProgress(t('reviewResult', { completed: done.length, total: chosen.length }));
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
          return (
            <article
              key={row.id}
              className='border-border bg-muted/20 rounded-lg border p-3 sm:p-4'>
              <div className='flex items-start gap-3'>
                <input
                  type='checkbox'
                  className='accent-primary mt-1 size-5 shrink-0'
                  aria-label={t('selectObservation', { description: row.description })}
                  checked={selected.includes(row.id)}
                  disabled={busy}
                  onChange={() => toggle(row)}
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
                        : `${row.currency ?? '?'} ${row.amount.toLocaleString()}`}
                    </strong>
                  </div>
                  {suggestion.currency && (
                    <p className='mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300'>
                      <AlertCircle className='size-3.5' aria-hidden='true' />
                      {t('currencySuggestion', { currency: suggestion.currency.value })}
                    </p>
                  )}
                  {suggestion.previouslyRejected && (
                    <p className='mt-1 text-xs text-amber-700 dark:text-amber-300'>
                      {t('previouslyRejectedHint')}
                    </p>
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
                      <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                        <label className='space-y-1 text-sm'>
                          {t('transactionDate')}
                          <Input
                            type='date'
                            value={draft.date}
                            disabled={busy || !!createdIds.current[row.id]}
                            onChange={(event) => updateDraft(row.id, { date: event.target.value })}
                          />
                        </label>
                        <label className='space-y-1 text-sm'>
                          {t('transactionTime')}
                          <Input
                            type='time'
                            value={draft.time}
                            disabled={busy || !!createdIds.current[row.id]}
                            onChange={(event) => updateDraft(row.id, { time: event.target.value })}
                          />
                          <span className='text-muted-foreground block text-xs'>
                            {t('timeOptional')}
                          </span>
                        </label>
                        <label className='space-y-1 text-sm'>
                          {t('transactionAmount')}
                          <Input
                            type='number'
                            min='0.01'
                            step='0.01'
                            value={draft.amount}
                            disabled={busy || !!createdIds.current[row.id]}
                            onChange={(event) =>
                              updateDraft(row.id, { amount: event.target.value })
                            }
                          />
                        </label>
                        <label className='space-y-1 text-sm'>
                          {t('transactionCurrency')}
                          <select
                            className='border-input bg-background h-10 w-full rounded-md border px-3'
                            value={draft.currency}
                            disabled={busy || !!createdIds.current[row.id]}
                            onChange={(event) =>
                              updateDraft(row.id, { currency: event.target.value })
                            }>
                            <option value=''>{t('selectCurrency')}</option>
                            <option value='COP'>COP</option>
                            <option value='USD'>USD</option>
                          </select>
                        </label>
                        <label className='space-y-1 text-sm'>
                          {t('transactionType')}
                          <select
                            className='border-input bg-background h-10 w-full rounded-md border px-3'
                            value={draft.type}
                            disabled={busy || !!createdIds.current[row.id]}
                            onChange={(event) =>
                              updateDraft(row.id, {
                                type: event.target.value as ReviewDraft['type'],
                                categoryId: '',
                                destinationAccountId: '',
                              })
                            }>
                            <option value='expense'>{t('expense')}</option>
                            <option value='income'>{t('income')}</option>
                            <option value='transfer'>{t('transfer')}</option>
                          </select>
                        </label>
                        <label className='space-y-1 text-sm'>
                          {t('transactionAccount')}
                          <select
                            className='border-input bg-background h-10 w-full rounded-md border px-3'
                            value={draft.accountId}
                            disabled={busy || !!createdIds.current[row.id]}
                            onChange={(event) =>
                              updateDraft(row.id, { accountId: event.target.value })
                            }>
                            <option value=''>{t('selectAccount')}</option>
                            {activeAccounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {draft.type === 'transfer' && (
                          <label className='space-y-1 text-sm'>
                            {t('destinationAccount')}
                            <select
                              className='border-input bg-background h-10 w-full rounded-md border px-3'
                              value={draft.destinationAccountId}
                              disabled={busy || !!createdIds.current[row.id]}
                              onChange={(event) =>
                                updateDraft(row.id, { destinationAccountId: event.target.value })
                              }>
                              <option value=''>{t('selectAccount')}</option>
                              {activeAccounts
                                .filter((account) => account.id !== draft.accountId)
                                .map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                        {draft.type !== 'transfer' && (
                          <label className='space-y-1 text-sm'>
                            {t('transactionCategory')}
                            <select
                              className='border-input bg-background h-10 w-full rounded-md border px-3'
                              value={draft.categoryId}
                              disabled={busy || !!createdIds.current[row.id]}
                              onChange={(event) =>
                                updateDraft(row.id, { categoryId: event.target.value })
                              }>
                              <option value=''>{t('selectCategory')}</option>
                              {categories
                                .filter(
                                  (category) => category.type === draft.type && category.is_active,
                                )
                                .map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                        <label className='space-y-1 text-sm sm:col-span-2'>
                          {t('transactionDescription')}
                          <Input
                            value={draft.description}
                            disabled={busy || !!createdIds.current[row.id]}
                            onChange={(event) =>
                              updateDraft(row.id, { description: event.target.value })
                            }
                          />
                        </label>
                      </div>
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
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {chosen.length > 0 && (
        <div className='border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-4'>
          <p className='font-semibold'>{t('selectedCount', { count: chosen.length })}</p>
          <label className='block space-y-1 text-sm'>
            {t('bulkAccount')}
            <select
              aria-label={t('bulkAccount')}
              className='border-input bg-background h-10 w-full rounded-md border px-3'
              value={bulkAccount}
              disabled={busy}
              onChange={(event) => selectAccount(event.target.value)}>
              <option value=''>{t('selectAccount')}</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <p className='text-muted-foreground text-xs'>{t('batchReviewWarning')}</p>
          <label className='flex items-start gap-2 text-sm'>
            <input
              type='checkbox'
              className='accent-primary mt-1 size-4'
              aria-label={t('confirmSelected')}
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
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
              <div className='mt-3 flex gap-2'>
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={busy}
                  onClick={() => void reject()}>
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
