import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
  inferDocumentTransactionType,
  validateDocumentDraft,
  type ApprovalDraft,
  type ReviewHistoryObservation,
} from '@/lib/document-review';
import type { Account, Category, Transaction } from '@/types';
import type { ReconciliationCandidate } from '@/lib/document-reconciliation';
import { merchantSuggestionQuery } from '@/lib/api/queries/merchant-suggestion.queries';

export interface DocumentReviewRow extends ReviewHistoryObservation {
  ordinal: number;
  amount: number | null;
  occurred_at_text: string | null;
  status: string;
  confidence: number;
}

export interface ReviewDraft extends ApprovalDraft {
  categoryId: string;
  sourceExcerpt: string;
  originalAmount: number;
  originalCurrency: string | null;
  originalDateTime: string | null;
  originalDescription: string;
  suggested: boolean;
  learned: boolean;
}

export interface UseDocumentBatchReviewProps {
  documentId: string;
  rows: DocumentReviewRow[];
  history: ReviewHistoryObservation[];
  accounts: Account[];
  categories: Category[];
  onRefresh: () => Promise<void>;
  suggestions?: DocumentSuggestionGroup[];
}

interface MatchReview {
  row: DocumentReviewRow;
  candidate: Pick<ReconciliationCandidate, 'transaction_id' | 'description' | 'date' | 'amount'>;
}

export interface UseDocumentBatchReviewResult {
  pending: DocumentReviewRow[];
  chosen: DocumentReviewRow[];
  selected: string[];
  drafts: Record<string, ReviewDraft>;
  bulkAccount: string;
  confirmed: boolean;
  setConfirmed: Dispatch<SetStateAction<boolean>>;
  rejectTarget: DocumentReviewRow[] | null;
  setRejectTarget: Dispatch<SetStateAction<DocumentReviewRow[] | null>>;
  expandedRowId: string | null;
  matchReview: MatchReview | null;
  setMatchReview: Dispatch<SetStateAction<MatchReview | null>>;
  busy: boolean;
  progress: string;
  errors: Record<string, string>;
  duplicates: Record<string, Transaction>;
  aiBusy: string | null;
  aiHints: Record<string, string>;
  activeAccounts: Account[];
  sharedCurrency: string | null;
  hasCreatedTransaction: (id: string) => boolean;
  toggle: (row: DocumentReviewRow) => void;
  editRow: (row: DocumentReviewRow) => void;
  selectAll: () => void;
  updateDraft: (id: string, patch: Partial<ReviewDraft>) => void;
  selectAccount: (accountId: string) => void;
  suggestCategoryWithAi: (row: DocumentReviewRow) => Promise<void>;
  approve: () => Promise<void>;
  rejectRows: (rows: DocumentReviewRow[], reason: string, reasonDetail?: string) => Promise<void>;
  linkExisting: () => Promise<void>;
}

export function useDocumentBatchReview({
  documentId,
  rows,
  history,
  accounts,
  categories,
  onRefresh,
  suggestions = [],
}: UseDocumentBatchReviewProps): UseDocumentBatchReviewResult {
  const t = useTranslations('documents');
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [bulkAccount, setBulkAccount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<DocumentReviewRow[] | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [matchReview, setMatchReview] = useState<MatchReview | null>(null);
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

  const draftFor = (row: DocumentReviewRow): ReviewDraft => {
    const suggestion = suggestDocumentReview(row, history, sharedCurrency);
    const inferredType = inferDocumentTransactionType(
      row.amount,
      row.description,
      row.source_excerpt,
    );
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
  };

  const editRow = (row: DocumentReviewRow): void => {
    const draft = drafts[row.id] ?? draftFor(row);
    setSelected((current) => (current.includes(row.id) ? current : [...current, row.id]));
    setDrafts((current) =>
      Object.hasOwn(current, row.id) ? current : { ...current, [row.id]: draft },
    );
    setExpandedRowId((current) => (current === row.id ? null : row.id));
    setConfirmed(false);

    const merchant = (row.counterparty || row.description).trim();
    const categoryScope = categories
      .filter((category) => category.type === 'expense' && category.is_active)
      .map((category) => category.id)
      .sort()
      .join(',');
    if (
      expandedRowId === row.id ||
      draft.type !== 'expense' ||
      draft.currency !== 'COP' ||
      draft.categoryId ||
      aiBusy ||
      merchant.length < 2 ||
      merchant.length > 120 ||
      !categoryScope
    )
      return;

    setAiBusy(row.id);
    void queryClient
      .fetchQuery(merchantSuggestionQuery(merchant, categoryScope))
      .then(({ category_id }) => {
        const category = categories.find(
          (candidate) =>
            candidate.id === category_id && candidate.type === 'expense' && candidate.is_active,
        );
        if (!category) return;
        setDrafts((current) => {
          if (!Object.hasOwn(current, row.id) || current[row.id].categoryId) return current;
          return { ...current, [row.id]: { ...current[row.id], categoryId: category.id } };
        });
        setAiHints((current) => ({ ...current, [row.id]: category.name }));
      })
      .catch(() => undefined)
      .finally(() => setAiBusy((current) => (current === row.id ? null : current)));
  };

  const selectAll = (): void => {
    const allSelected = pending.every((row) => selected.includes(row.id));
    setSelected(allSelected ? [] : pending.map((row) => row.id));
    if (!allSelected)
      setDrafts((current) =>
        Object.fromEntries(pending.map((row) => [row.id, current[row.id] ?? draftFor(row)])),
      );
    setConfirmed(false);
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
    reasonDetail?: string,
  ): Promise<void> => {
    decisionKeys.current[observationId] ??= crypto.randomUUID();
    await decideDocumentObservation({
      documentId,
      observationId,
      action,
      transactionId,
      reason,
      reasonDetail,
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

  const rejectRows = async (
    targetRows: DocumentReviewRow[],
    reason: string,
    reasonDetail?: string,
  ): Promise<void> => {
    if (busy || targetRows.length === 0) return;
    setBusy(true);
    const nextErrors: Record<string, string> = {};
    const done: string[] = [];
    for (const row of targetRows) {
      try {
        await decide(row.id, 'reject_observation', undefined, reason, reasonDetail);
        done.push(row.id);
      } catch (cause) {
        nextErrors[row.id] = cause instanceof Error ? cause.message : t('decisionFailed');
      }
    }
    setErrors(nextErrors);
    setSelected((current) => current.filter((id) => !done.includes(id)));
    setRejectTarget(null);
    setBusy(false);
    setProgress(t('reviewResult', { completed: done.length, total: targetRows.length }));
    await onRefresh();
  };

  const linkExisting = async (): Promise<void> => {
    if (!matchReview || busy) return;
    setBusy(true);
    const { row, candidate } = matchReview;
    try {
      await decide(row.id, 'accept', candidate.transaction_id);
      setMatchReview(null);
      setSelected((current) => current.filter((id) => id !== row.id));
      setErrors((current) => ({ ...current, [row.id]: '' }));
      await onRefresh();
    } catch (cause) {
      setErrors((current) => ({
        ...current,
        [row.id]: cause instanceof Error ? cause.message : t('decisionFailed'),
      }));
    } finally {
      setBusy(false);
    }
  };

  return {
    pending,
    chosen,
    selected,
    drafts,
    bulkAccount,
    confirmed,
    setConfirmed,
    rejectTarget,
    setRejectTarget,
    expandedRowId,
    matchReview,
    setMatchReview,
    busy,
    progress,
    errors,
    duplicates,
    aiBusy,
    aiHints,
    activeAccounts,
    sharedCurrency,
    hasCreatedTransaction: (id: string): boolean => !!createdIds.current[id],
    toggle,
    editRow,
    selectAll,
    updateDraft,
    selectAccount,
    suggestCategoryWithAi,
    approve,
    rejectRows,
    linkExisting,
  };
}
