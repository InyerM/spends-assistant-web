'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ShortcutCreateFields, type ShortcutCreateDraft } from './shortcut-create-fields';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useMerchantSuggestion } from '@/lib/api/queries/merchant-suggestion.queries';
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

export function ShortcutCreateForm({
  inboxId,
  rawText,
  receivedAt,
  preview = null,
  analysis,
  onCreated,
  onCancel,
}: {
  inboxId: string;
  rawText: string;
  receivedAt: string;
  preview?: LuloNoticePreview | null;
  analysis?: ForwardedEmailAnalysis;
  onCreated: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const historyQuery = useTransactions(
    { search: preview?.merchant ?? '', type: 'expense', limit: 50 },
    { enabled: preview?.kind === 'card_purchase' && !!preview.merchant },
  );
  const createMutation = useCreateInboxTransaction();
  const [fieldDraft, setFieldDraft] = useState(() => buildForwardedEmailDraft(preview, receivedAt));
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [review, setReview] = useState<CandidateReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persistedAccountId = (accountsQuery.data ?? []).some(
    (account) =>
      account.id === analysis?.account_id &&
      account.is_active &&
      !account.deleted_at &&
      account.type === 'credit_card' &&
      account.currency === 'COP' &&
      account.last_four === preview?.cardLastFour &&
      /\blulo\b/iu.test(`${account.institution ?? ''} ${account.name}`),
  )
    ? (analysis?.account_id ?? '')
    : '';
  const suggestedAccountId =
    persistedAccountId ||
    inferForwardedAccount(preview, accountsQuery.data ?? []) ||
    inferForwardedBancolombiaAccount(rawText, accountsQuery.data ?? []);
  const localSuggestedCategoryId = suggestForwardedCategory(
    preview,
    historyQuery.data?.data ?? [],
    categoriesQuery.data ?? [],
  );
  const persistedCategoryId = (categoriesQuery.data ?? []).some(
    (category) =>
      category.id === analysis?.category_id && category.type === 'expense' && category.is_active,
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
    ...fieldDraft,
    accountId: selectedAccountId ?? suggestedAccountId,
    categoryId: selectedCategoryId ?? (fieldDraft.type === 'expense' ? suggestedCategoryId : ''),
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
    if (
      !draft.accountId ||
      !draft.categoryId ||
      !draft.amount ||
      !draft.date ||
      !draft.description.trim()
    ) {
      setError(t('completeRequired'));
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
        category_id: draft.categoryId,
        type: draft.type,
        amount: draft.amount,
        date: draft.date,
        description: draft.description.trim(),
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
      className='border-border bg-card-overlay space-y-4 rounded-xl border p-4 text-sm'
      onSubmit={(event): void => {
        event.preventDefault();
        void submit();
      }}>
      <p className='font-medium'>{t('createTitle')}</p>
      <p className='text-muted-foreground'>{t('createCaution')}</p>
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
              disabled={createMutation.isPending}
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
