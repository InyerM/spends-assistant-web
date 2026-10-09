'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { InlineLoader } from '@/components/shared/loader';
import { Button } from '@/components/ui/button';
import { ShortcutCreateFields, type ShortcutCreateDraft } from './shortcut-create-fields';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useMerchantSuggestion } from '@/lib/api/queries/merchant-suggestion.queries';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import {
  useCreateInboxTransaction,
  type CandidateReview,
  type ForwardedEmailAnalysis,
} from '@/lib/api/mutations/shortcut-inbox.mutations';
import {
  buildForwardedEmailDraft,
  inferForwardedAccount,
  inferForwardedBancolombiaAccount,
  suggestForwardedCategory,
} from '@/lib/shortcut-inbox/create-draft';
import type { LuloNoticePreview } from '@/lib/shortcut-inbox/lulo-preview';
import { previewBancolombiaNotice } from '@/lib/shortcut-inbox/bancolombia-preview';

export function ShortcutCreateForm({
  inboxId,
  rawText,
  receivedAt,
  preview = null,
  analysis,
  analyzing = false,
  onCreated,
  onCancel,
}: {
  inboxId: string;
  rawText: string;
  receivedAt: string;
  preview?: LuloNoticePreview | null;
  analysis?: ForwardedEmailAnalysis;
  analyzing?: boolean;
  onCreated: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const transactionT = useTranslations('transactions');
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const historyQuery = useTransactions(
    { search: preview?.merchant ?? '', type: 'expense', limit: 50 },
    { enabled: preview?.kind === 'card_purchase' && !!preview.merchant },
  );
  const createMutation = useCreateInboxTransaction();
  const bancolombia = previewBancolombiaNotice('forwarded_email', rawText);
  const [fieldDraft, setFieldDraft] = useState<Partial<ShortcutCreateDraft>>({});
  const base = buildForwardedEmailDraft(preview, receivedAt, bancolombia);
  const proposedDraft = {
    ...base,
    destinationAccountId: '',
    type: analysis?.suggested_type ?? base.type,
    description: analysis?.description || base.description,
    notes: analysis?.notes ?? base.notes,
    ...fieldDraft,
  };
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [review, setReview] = useState<CandidateReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inferredAccountId =
    inferForwardedAccount(preview, accountsQuery.data ?? []) ||
    inferForwardedBancolombiaAccount(rawText, accountsQuery.data ?? []);
  const persistedAccountId = (accountsQuery.data ?? []).some(
    (account) =>
      account.id === analysis?.account_id &&
      account.is_active &&
      !account.deleted_at &&
      account.currency === 'COP',
  )
    ? (analysis?.account_id ?? '')
    : '';
  const suggestedAccountId = persistedAccountId || inferredAccountId;
  const localSuggestedCategoryId = suggestForwardedCategory(
    preview,
    historyQuery.data?.data ?? [],
    categoriesQuery.data ?? [],
  );
  const persistedCategoryId = (categoriesQuery.data ?? []).some(
    (category) =>
      category.id === analysis?.category_id &&
      category.type === proposedDraft.type &&
      category.is_active,
  )
    ? (analysis?.category_id ?? '')
    : '';
  const categoryScope = (categoriesQuery.data ?? [])
    .filter((category) => category.type === 'expense' && category.is_active)
    .map((category) => category.id)
    .sort()
    .join(',');
  const aiCategoryQuery = useMerchantSuggestion(
    preview?.kind === 'card_purchase' ? (preview.merchant ?? undefined) : undefined,
    !historyQuery.isPending &&
      categoriesQuery.isSuccess &&
      !localSuggestedCategoryId &&
      analysis === undefined &&
      !analyzing &&
      selectedCategoryId === null,
    categoryScope,
  );
  const aiCategoryId = (categoriesQuery.data ?? []).some(
    (category) =>
      category.id === aiCategoryQuery.data?.category_id &&
      category.type === 'expense' &&
      category.is_active,
  )
    ? (aiCategoryQuery.data?.category_id ?? '')
    : '';
  const suggestedCategoryId = persistedCategoryId || localSuggestedCategoryId || aiCategoryId;
  const draft: ShortcutCreateDraft = {
    ...proposedDraft,
    accountId: selectedAccountId ?? suggestedAccountId,
    categoryId:
      selectedCategoryId ??
      (proposedDraft.type === 'expense' ? suggestedCategoryId : persistedCategoryId),
  };

  const changeDraft = (patch: Partial<ShortcutCreateDraft>): void => {
    const { accountId, categoryId, ...fields } = patch;
    if (accountId !== undefined) setSelectedAccountId(accountId);
    if (categoryId !== undefined) setSelectedCategoryId(categoryId);
    if (Object.keys(fields).length) setFieldDraft((current) => ({ ...current, ...fields }));
    setReview(null);
    setError(null);
  };

  const submit = async (confirmDistinct = false): Promise<void> => {
    if (analyzing) return;
    if (
      !draft.accountId ||
      (draft.type !== 'transfer' && !draft.categoryId) ||
      !draft.amount ||
      !draft.date ||
      !draft.description.trim()
    ) {
      setError(t('completeRequired'));
      return;
    }
    if (
      draft.type === 'transfer' &&
      (!draft.destinationAccountId || draft.destinationAccountId === draft.accountId)
    ) {
      setError(
        transactionT(draft.destinationAccountId ? 'destinationDistinct' : 'destinationRequired'),
      );
      return;
    }
    if (draft.eventTime && !draft.eventTimeConfirmed) {
      setError(t('eventTimeNeedsConfirmation'));
      return;
    }
    setError(null);
    try {
      const result = await createMutation.mutateAsync({
        inboxId,
        account_id: draft.accountId,
        category_id: draft.type === 'transfer' ? null : draft.categoryId,
        ...(draft.type === 'transfer'
          ? { transfer_to_account_id: draft.destinationAccountId }
          : {}),
        type: draft.type,
        amount: draft.amount,
        date: draft.date,
        description: draft.description.trim(),
        notes: draft.notes.trim(),
        ...(draft.eventTime
          ? {
              event_at: `${draft.date}T${draft.eventTime}:00-05:00`,
              event_time_confirmed: true as const,
            }
          : {}),
        ...(confirmDistinct && review?.status === 'review_required'
          ? { reviewed_candidate_hash: review.candidate_hash, confirm_distinct: true as const }
          : {}),
      });
      if (result.status === 'created') onCreated();
      else setReview(result);
    } catch {
      setError(t('createFailed'));
    }
  };

  const optionsError = accountsQuery.isError || categoriesQuery.isError;
  return (
    <form
      aria-busy={analyzing}
      className='border-border bg-card-overlay space-y-4 rounded-xl border p-4 text-sm'
      onSubmit={(event): void => {
        event.preventDefault();
        void submit();
      }}>
      <p className='font-medium'>{t('createTitle')}</p>
      <p className='text-muted-foreground'>{t('createCaution')}</p>
      {(analyzing || analysis) && (
        <div
          role='status'
          className='flex items-center gap-2 rounded-lg border border-[var(--ai-gradient-start)]/30 bg-[var(--ai-gradient-start)]/5 p-3 text-[var(--ai-gradient-start)]'>
          {analyzing && <InlineLoader />}
          <span>{t(analyzing ? 'analysisRunning' : 'analysisReady')}</span>
        </div>
      )}
      {optionsError && (
        <p role='alert' className='text-destructive'>
          {t('optionsFailed')}
        </p>
      )}
      <ShortcutCreateFields
        draft={draft}
        accounts={accountsQuery.data ?? []}
        categories={categoriesQuery.data ?? []}
        onChange={changeDraft}
        analysisStates={{
          accountId:
            selectedAccountId === null
              ? analyzing
                ? 'analyzing'
                : persistedAccountId
                  ? 'suggested'
                  : undefined
              : undefined,
          categoryId:
            selectedCategoryId === null
              ? analyzing
                ? 'analyzing'
                : persistedCategoryId
                  ? 'suggested'
                  : undefined
              : undefined,
          type:
            fieldDraft.type === undefined
              ? analyzing
                ? 'analyzing'
                : analysis?.suggested_type
                  ? 'suggested'
                  : undefined
              : undefined,
          description:
            fieldDraft.description === undefined
              ? analyzing
                ? 'analyzing'
                : analysis?.description
                  ? 'suggested'
                  : undefined
              : undefined,
          notes:
            fieldDraft.notes === undefined
              ? analyzing
                ? 'analyzing'
                : analysis?.notes
                  ? 'suggested'
                  : undefined
              : undefined,
        }}
      />
      {aiCategoryId && selectedCategoryId === null && (
        <p className='text-muted-foreground'>
          {t(
            aiCategoryQuery.data?.source === 'catalog'
              ? 'merchantCatalogSuggestion'
              : 'aiCategorySuggestion',
          )}
        </p>
      )}
      {aiCategoryQuery.error instanceof AiConsentRequiredError && (
        <AiConsentNotice scope={aiCategoryQuery.error.scope} />
      )}
      {error && (
        <p role='alert' className='text-destructive'>
          {error}
        </p>
      )}
      {review && (
        <div className='border-brand-secondary/30 bg-brand-secondary/5 space-y-2 rounded-lg border p-3'>
          <p>
            {review.status === 'review_overflow'
              ? t('overflowCaution')
              : t('distinctCaution', { count: review.candidate_count })}
          </p>
          {review.candidates.map((candidate) => (
            <p key={candidate.id}>
              {candidate.date} · {candidate.amount} · {candidate.description} · {candidate.source}
            </p>
          ))}
          {review.status === 'review_required' && (
            <Button
              type='button'
              disabled={analyzing || createMutation.isPending}
              onClick={(): void => void submit(true)}>
              {t('confirmDistinct')}
            </Button>
          )}
        </div>
      )}
      <div className='flex gap-2'>
        {!review && (
          <Button
            type='submit'
            disabled={
              analyzing ||
              createMutation.isPending ||
              optionsError ||
              accountsQuery.isPending ||
              categoriesQuery.isPending
            }>
            {t('saveReviewed')}
          </Button>
        )}
        <Button
          type='button'
          variant='outline'
          disabled={createMutation.isPending}
          onClick={onCancel}>
          {t('cancelCreate')}
        </Button>
      </div>
    </form>
  );
}
