'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { FileImage, LoaderCircle, ScanText, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DocumentBatchReview } from '@/components/documents/document-batch-review';
import { DocumentReviewFields } from '@/components/documents/document-review-fields';
import { MAX_DOCUMENT_BYTES } from '@/lib/documents';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { createTransaction, DuplicateError } from '@/lib/api/mutations/transaction.mutations';
import {
  decideDocumentObservation,
  extractDocument,
  restoreDocumentObservation,
  setDocumentArchived,
  uploadDocument,
} from '@/lib/api/mutations/document.mutations';
import {
  documentKeys,
  fetchDocumentSuggestions,
  useDocuments,
  type DocumentObservation,
  type DocumentSuggestionGroup,
  type StoredDocument,
} from '@/lib/api/queries/document.queries';
import type { ReconciliationCandidate } from '@/lib/document-reconciliation';
import type { Transaction } from '@/types';

type Observation = DocumentObservation;
type Document = StoredDocument;
type Candidate = ReconciliationCandidate;
type SuggestionGroup = DocumentSuggestionGroup;

interface CreateDraft {
  documentId: string;
  observationId: string;
  date: string;
  time: string;
  amount: string;
  currency: string;
  signedAmount: number;
  description: string;
  type: 'expense' | 'income' | 'transfer';
  accountId: string;
  destinationAccountId: string;
  categoryId: string;
  sourceExcerpt: string;
  decisionKey: string;
  createdId: string | null;
}

function SuggestionPanel({
  group,
  onReview,
}: {
  group: SuggestionGroup | undefined;
  onReview: (candidate: Candidate) => void;
}): React.ReactElement | null {
  const t = useTranslations('documents');
  if (!group) return null;
  if (group.status !== 'pending') {
    return <p className='text-muted-foreground mt-3 text-xs'>{t('alreadyReviewed')}</p>;
  }
  if (group.candidates.length === 0) {
    return <p className='text-muted-foreground mt-3 text-sm'>{t('noCandidates')}</p>;
  }
  return (
    <div className='border-border mt-4 space-y-2 border-t pt-3'>
      {group.candidates.map((candidate) => (
        <div key={candidate.transaction_id} className='border-border bg-card rounded-lg border p-3'>
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <div>
              <div className='flex items-center gap-2'>
                <p className='text-sm font-medium'>{candidate.description}</p>
                <Badge variant='outline'>{t('candidate')}</Badge>
              </div>
              <p className='text-muted-foreground mt-1 text-xs'>
                {[candidate.date, candidate.account_name, t(`basis.${candidate.basis}`)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <span className='text-sm font-semibold tabular-nums'>
              {candidate.amount.toLocaleString()}
            </span>
          </div>
          <p className='text-muted-foreground mt-2 text-xs'>
            {t('amountDifference', { amount: candidate.amount_difference })}
            {candidate.reference_hint ? ` · ${t('referenceHint')}` : ''}
            {candidate.description_hint ? ` · ${t('descriptionHint')}` : ''}
          </p>
          <Button size='sm' variant='outline' className='mt-3' onClick={() => onReview(candidate)}>
            {t('reviewMatch')}
          </Button>
        </div>
      ))}
      {group.total_candidates > group.candidates.length && (
        <p className='text-muted-foreground text-xs'>
          {t('showingCandidates', {
            shown: group.candidates.length,
            total: group.total_candidates,
          })}
        </p>
      )}
      {group.search_limited && (
        <p className='text-muted-foreground text-xs'>{t('searchLimited')}</p>
      )}
    </div>
  );
}

export default function DocumentsPage(): React.ReactElement {
  const t = useTranslations('documents');
  const queryClient = useQueryClient();
  const documentQuery = useDocuments();
  const refetchDocuments = documentQuery.refetch;
  const documents = documentQuery.data ?? [];
  const loading = documentQuery.isPending;
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Partial<Record<string, SuggestionGroup[]>>>({});
  const [suggestionBusy, setSuggestionBusy] = useState<string | null>(null);
  const [review, setReview] = useState<
    | {
        documentId: string;
        observationId: string;
        action: 'accept';
        candidate: Candidate;
        key: string;
      }
    | { documentId: string; observationId: string; action: 'reject_observation'; key: string }
    | null
  >(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [createChecked, setCreateChecked] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<Transaction | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const result = await refetchDocuments();
    if (result.error) throw result.error;
    setError(null);
  }, [refetchDocuments]);

  const upload = async (file: File): Promise<void> => {
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > MAX_DOCUMENT_BYTES ||
      file.size === 0
    ) {
      setError(t('invalidFile'));
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      await uploadDocument(file);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('uploadFailed'));
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const extract = async (id: string): Promise<void> => {
    setBusy(id);
    setError(null);
    try {
      await extractDocument(id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('extractFailed'));
    } finally {
      setBusy(null);
    }
  };

  const findSuggestions = async (id: string): Promise<void> => {
    setSuggestionBusy(id);
    setError(null);
    try {
      const result = await queryClient.fetchQuery({
        queryKey: documentKeys.suggestions(id),
        queryFn: () => fetchDocumentSuggestions(id),
        staleTime: 0,
      });
      setSuggestions((current) => ({ ...current, [id]: result }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('suggestionsFailed'));
    } finally {
      setSuggestionBusy(null);
    }
  };

  const archiveCapture = async (id: string, archived: boolean): Promise<void> => {
    setBusy(id);
    try {
      await setDocumentArchived(id, archived);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('loadFailed'));
    } finally {
      setBusy(null);
    }
  };

  const restoreObservation = async (documentId: string, observationId: string): Promise<void> => {
    setBusy(observationId);
    try {
      await restoreDocumentObservation(documentId, observationId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('decisionFailed'));
    } finally {
      setBusy(null);
    }
  };

  const submitDecision = async (): Promise<void> => {
    if (!review || decisionBusy) return;
    setDecisionBusy(true);
    setError(null);
    try {
      await decideDocumentObservation({
        documentId: review.documentId,
        observationId: review.observationId,
        action: review.action,
        transactionId: review.action === 'accept' ? review.candidate.transaction_id : undefined,
        key: review.key,
        reason: review.action === 'reject_observation' ? 'other' : undefined,
      });
      const documentId = review.documentId;
      setReview(null);
      setSuggestions((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== documentId)),
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('decisionFailed'));
    } finally {
      setDecisionBusy(false);
    }
  };

  const startCreate = (document: Document, observation: Observation): void => {
    const occurred = observation.occurred_at_text ?? '';
    setCreateDraft({
      documentId: document.id,
      observationId: observation.id,
      date: /^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(occurred) ? occurred.slice(0, 10) : '',
      time: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(occurred) ? occurred.slice(11, 16) : '',
      amount: String(Math.abs(observation.amount ?? 0)),
      currency: 'COP',
      signedAmount: observation.amount ?? 0,
      description: observation.description,
      type: 'expense',
      accountId: '',
      destinationAccountId: '',
      categoryId: '',
      sourceExcerpt: observation.source_excerpt,
      decisionKey: crypto.randomUUID(),
      createdId: null,
    });
    setCreateChecked(false);
    setDuplicateMatch(null);
    setError(null);
  };

  const updateCreateDraft = (patch: Partial<CreateDraft>): void => {
    setCreateDraft((current) => current && { ...current, ...patch });
    setCreateChecked(false);
    setDuplicateMatch(null);
  };

  const confirmCreate = async (): Promise<void> => {
    if (!createDraft || !createChecked || createBusy) return;
    const amount = Number(createDraft.amount);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(createDraft.date) ||
      !/^\d{2}:\d{2}$/.test(createDraft.time) ||
      !createDraft.accountId ||
      createDraft.currency !== 'COP' ||
      (createDraft.type === 'transfer' &&
        (!createDraft.destinationAccountId ||
          createDraft.destinationAccountId === createDraft.accountId)) ||
      !createDraft.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(t('createFieldsRequired'));
      return;
    }
    setCreateBusy(true);
    setError(null);
    try {
      let transactionId = createDraft.createdId;
      if (!transactionId) {
        const transaction = await createTransaction({
          date: createDraft.date,
          time: createDraft.time,
          amount,
          description: createDraft.description.trim(),
          type: createDraft.type,
          account_id: createDraft.accountId,
          transfer_to_account_id:
            createDraft.type === 'transfer' ? createDraft.destinationAccountId : undefined,
          category_id:
            createDraft.type === 'transfer' ? undefined : createDraft.categoryId || undefined,
          source: 'web-document',
          raw_text: createDraft.sourceExcerpt,
          parsed_data: {
            document_id: createDraft.documentId,
            observation_id: createDraft.observationId,
          },
        });
        transactionId = transaction.id;
        setCreateDraft((current) => current && { ...current, createdId: transaction.id });
      }
      await decideDocumentObservation({
        documentId: createDraft.documentId,
        observationId: createDraft.observationId,
        action: 'accept',
        transactionId,
        key: createDraft.decisionKey,
      });
      setCreateDraft(null);
      setCreateChecked(false);
      setDuplicateMatch(null);
      await load();
    } catch (cause) {
      if (cause instanceof DuplicateError) {
        setDuplicateMatch(cause.match);
        setError(t('duplicateFound'));
      } else {
        setError(cause instanceof Error ? cause.message : t('createFailed'));
      }
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className='mx-auto max-w-5xl space-y-6 p-4 sm:p-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h2 className='text-foreground text-2xl font-semibold'>{t('title')}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>{t('subtitle')}</p>
        </div>
        <input
          ref={inputRef}
          className='sr-only'
          type='file'
          accept='image/png,image/jpeg,image/webp'
          aria-label={t('chooseImage')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button disabled={busy !== null} onClick={() => inputRef.current?.click()}>
          {busy === 'upload' ? (
            <LoaderCircle className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Upload className='mr-2 h-4 w-4' />
          )}
          {busy === 'upload' ? t('uploading') : t('upload')}
        </Button>
        <Button variant='outline' onClick={() => setShowArchived((current) => !current)}>
          {showArchived
            ? t('activeCaptures')
            : `${t('archivedCaptures')} · ${documents.filter((document) => !!document.archived_at).length}`}
        </Button>
      </div>

      {(error || documentQuery.error) && (
        <p
          role='alert'
          className='text-destructive rounded-lg border border-current/20 p-3 text-sm'>
          {error ?? documentQuery.error?.message}
        </p>
      )}
      {loading ? (
        <p className='text-muted-foreground text-sm'>{t('loading')}</p>
      ) : documents.filter((document) => Boolean(document.archived_at) === showArchived).length ===
        0 ? (
        <Card>
          <CardContent className='flex flex-col items-center py-12 text-center'>
            <FileImage className='text-muted-foreground mb-3 h-10 w-10' />
            <p className='font-medium'>{t('empty')}</p>
            <p className='text-muted-foreground mt-1 text-sm'>{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {documents
            .filter((document) => Boolean(document.archived_at) === showArchived)
            .map((document) => (
              <Card key={document.id} className='gap-0 py-0'>
                <CardContent className='space-y-4 p-5'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='flex min-w-0 items-start gap-3'>
                      <span className='bg-primary/10 text-primary rounded-lg p-2'>
                        <FileImage className='h-5 w-5' />
                      </span>
                      <div className='min-w-0'>
                        <h3 className='truncate font-medium'>{document.file_name}</h3>
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {new Date(document.created_at).toLocaleString()} ·{' '}
                          {document.document_type
                            ? t(`type.${document.document_type}`)
                            : t('unclassified')}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline'>{t(`status.${document.status}`)}</Badge>
                      <Button
                        size='sm'
                        variant='ghost'
                        disabled={busy !== null}
                        onClick={() => void archiveCapture(document.id, !document.archived_at)}>
                        {document.archived_at ? t('restoreCapture') : t('archiveCapture')}
                      </Button>
                      {!document.archived_at &&
                        (document.status === 'uploaded' ||
                          document.status === 'failed' ||
                          (document.status === 'processing' &&
                            Date.now() - new Date(document.updated_at).getTime() >
                              5 * 60 * 1000)) && (
                          <Button
                            size='sm'
                            variant='outline'
                            disabled={busy !== null}
                            onClick={() => void extract(document.id)}>
                            {busy === document.id ? (
                              <LoaderCircle className='mr-2 h-4 w-4 animate-spin' />
                            ) : (
                              <ScanText className='mr-2 h-4 w-4' />
                            )}
                            {busy === document.id ? t('extracting') : t('extract')}
                          </Button>
                        )}
                    </div>
                  </div>
                  {document.status === 'extracted' && !document.archived_at && (
                    <details
                      className='border-border border-t pt-4'
                      onToggle={(event) => {
                        if (
                          event.currentTarget.open &&
                          !suggestions[document.id] &&
                          suggestionBusy !== document.id
                        )
                          void findSuggestions(document.id);
                      }}>
                      <summary className='text-foreground cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2'>
                        {t('observations')} · {document.document_observations.length}
                      </summary>
                      <div className='mt-4 space-y-4'>
                        <DocumentBatchReview
                          documentId={document.id}
                          rows={document.document_observations.map((observation) => ({
                            ...observation,
                            document_type: document.document_type,
                          }))}
                          history={documents.flatMap((entry) =>
                            entry.document_observations.map((observation) => ({
                              ...observation,
                              document_type: entry.document_type,
                            })),
                          )}
                          accounts={accounts ?? []}
                          categories={categories ?? []}
                          suggestions={suggestions[document.id]}
                          onRefresh={load}
                        />
                        <details className='border-border border-t pt-3'>
                          <summary className='text-muted-foreground cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-offset-2'>
                            {t('advancedReview')}
                          </summary>
                          <div className='mt-3 space-y-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                              <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                                {t('observations')}
                              </p>
                              <Button
                                size='sm'
                                variant='outline'
                                disabled={suggestionBusy !== null}
                                onClick={() => void findSuggestions(document.id)}>
                                {suggestionBusy === document.id
                                  ? t('findingSuggestions')
                                  : t('findSuggestions')}
                              </Button>
                            </div>
                            {suggestions[document.id] && (
                              <p className='text-muted-foreground text-xs'>{t('candidateOnly')}</p>
                            )}
                            {document.document_observations.length === 0 ? (
                              <p className='text-muted-foreground text-sm'>{t('noObservations')}</p>
                            ) : (
                              [...document.document_observations]
                                .filter((observation) => observation.status !== 'rejected')
                                .sort((a, b) => a.ordinal - b.ordinal)
                                .map((observation) => (
                                  <div key={observation.id} className='bg-muted/40 rounded-lg p-4'>
                                    <div className='flex flex-wrap items-start justify-between gap-2'>
                                      <div>
                                        <p className='font-medium'>{observation.description}</p>
                                        <p className='text-muted-foreground mt-1 text-sm'>
                                          {[observation.counterparty, observation.occurred_at_text]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </p>
                                      </div>
                                      <span className='font-semibold tabular-nums'>
                                        {observation.amount === null
                                          ? t('amountUnknown')
                                          : `${observation.currency ?? ''} ${observation.amount.toLocaleString()}`}
                                      </span>
                                    </div>
                                    {observation.source_excerpt && (
                                      <p className='text-muted-foreground mt-3 border-l-2 pl-3 text-xs'>
                                        {observation.source_excerpt}
                                      </p>
                                    )}
                                    <p className='text-muted-foreground mt-2 text-xs'>
                                      {t('confidence', {
                                        percent: Math.round(observation.confidence * 100),
                                      })}{' '}
                                      · {t(`observationStatus.${observation.status}`)}
                                    </p>
                                    {observation.status === 'confirmed' &&
                                      observation.match_transaction_id && (
                                        <Link
                                          href={`/transactions/${observation.match_transaction_id}`}
                                          className='text-primary mt-2 inline-block text-sm font-medium underline underline-offset-2'>
                                          {t('confirmedMatch')} ·{' '}
                                          {observation.match_transaction_id.slice(0, 8)}
                                        </Link>
                                      )}
                                    <SuggestionPanel
                                      group={suggestions[document.id]?.find(
                                        (group) => group.observation_id === observation.id,
                                      )}
                                      onReview={(candidate) =>
                                        setReview({
                                          documentId: document.id,
                                          observationId: observation.id,
                                          action: 'accept',
                                          candidate,
                                          key: crypto.randomUUID(),
                                        })
                                      }
                                    />
                                    {observation.status === 'pending' &&
                                      observation.amount !== null &&
                                      (observation.currency === null ||
                                        observation.currency === 'COP') && (
                                        <Button
                                          size='sm'
                                          variant='outline'
                                          className='mt-3 mr-2'
                                          onClick={() => startCreate(document, observation)}>
                                          {t('createTransaction')}
                                        </Button>
                                      )}
                                    {observation.status === 'pending' &&
                                      observation.amount !== null &&
                                      observation.currency !== null &&
                                      observation.currency !== 'COP' && (
                                        <p className='text-muted-foreground mt-3 text-xs'>
                                          {t('unsupportedCurrency', {
                                            currency: observation.currency,
                                          })}
                                        </p>
                                      )}
                                    {createDraft?.observationId === observation.id &&
                                      createDraft.documentId === document.id && (
                                        <div className='border-primary/30 bg-background mt-4 space-y-3 rounded-lg border p-4'>
                                          <h4 className='font-medium'>{t('reviewCreate')}</h4>
                                          <p className='text-muted-foreground text-xs'>
                                            {t('reviewCreateHint')}
                                          </p>
                                          <DocumentReviewFields
                                            draft={createDraft}
                                            accounts={accounts ?? []}
                                            categories={categories ?? []}
                                            disabled={createDraft.createdId !== null}
                                            onChange={updateCreateDraft}
                                          />
                                          {duplicateMatch && (
                                            <Button
                                              size='sm'
                                              variant='outline'
                                              onClick={() => {
                                                setCreateDraft(
                                                  (current) =>
                                                    current && {
                                                      ...current,
                                                      createdId: duplicateMatch.id,
                                                    },
                                                );
                                                setDuplicateMatch(null);
                                                setCreateChecked(false);
                                              }}>
                                              {t('linkDuplicate', {
                                                description: duplicateMatch.description,
                                              })}
                                            </Button>
                                          )}
                                          {createDraft.createdId && (
                                            <p className='text-muted-foreground text-xs'>
                                              {t('createdNeedsLink')}
                                            </p>
                                          )}
                                          <label className='flex items-start gap-2 text-sm'>
                                            <Checkbox
                                              aria-label={t('createChecked')}
                                              checked={createChecked}
                                              onCheckedChange={(value) =>
                                                setCreateChecked(value === true)
                                              }
                                            />
                                            {t('createChecked')}
                                          </label>
                                          <div className='flex flex-wrap gap-2'>
                                            <Button
                                              size='sm'
                                              disabled={!createChecked || createBusy}
                                              onClick={() => void confirmCreate()}>
                                              {createBusy
                                                ? t('savingDecision')
                                                : createDraft.createdId
                                                  ? t('confirmLink')
                                                  : t('confirmCreate')}
                                            </Button>
                                            <Button
                                              size='sm'
                                              variant='ghost'
                                              disabled={createBusy}
                                              onClick={() => setCreateDraft(null)}>
                                              {t('cancelReview')}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    {review?.documentId === document.id &&
                                      review.observationId === observation.id && (
                                        <div
                                          className='border-primary/30 bg-primary/5 mt-3 rounded-lg border p-4'
                                          role='region'
                                          aria-label={t('reviewDecision')}>
                                          <p className='text-sm font-semibold'>
                                            {t('reviewDecision')}
                                          </p>
                                          <p className='text-muted-foreground mt-1 text-sm'>
                                            {review.action === 'accept'
                                              ? t('confirmMatchSummary')
                                              : t('confirmRejectSummary')}
                                          </p>
                                          {review.action === 'accept' && (
                                            <p className='mt-2 text-sm'>
                                              {review.candidate.description} ·{' '}
                                              {review.candidate.date} ·{' '}
                                              {review.candidate.account_name ?? ''} ·{' '}
                                              {review.candidate.amount.toLocaleString()}
                                            </p>
                                          )}
                                          <div className='mt-3 flex gap-2'>
                                            <Button
                                              size='sm'
                                              disabled={decisionBusy}
                                              onClick={() => void submitDecision()}>
                                              {decisionBusy
                                                ? t('savingDecision')
                                                : review.action === 'accept'
                                                  ? t('confirmMatch')
                                                  : t('confirmReject')}
                                            </Button>
                                            <Button
                                              size='sm'
                                              variant='outline'
                                              disabled={decisionBusy}
                                              onClick={() => setReview(null)}>
                                              {t('cancelReview')}
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                ))
                            )}
                          </div>
                        </details>
                        {document.document_observations.some(
                          (observation) => observation.status === 'rejected',
                        ) && (
                          <details className='border-border border-t pt-3'>
                            <summary className='text-muted-foreground cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-offset-2'>
                              {t('rejectedObservations')} ·{' '}
                              {
                                document.document_observations.filter(
                                  (observation) => observation.status === 'rejected',
                                ).length
                              }
                            </summary>
                            <div className='mt-3 space-y-2'>
                              {document.document_observations
                                .filter((observation) => observation.status === 'rejected')
                                .map((observation) => (
                                  <div
                                    key={observation.id}
                                    className='bg-muted/30 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3'>
                                    <div>
                                      <p className='text-sm font-medium'>
                                        {observation.description}
                                      </p>
                                      <p className='text-muted-foreground text-xs'>
                                        {observation.occurred_at_text}
                                      </p>
                                    </div>
                                    <span className='text-muted-foreground text-sm tabular-nums'>
                                      {observation.currency ?? ''}{' '}
                                      {observation.amount?.toLocaleString() ?? t('amountUnknown')}
                                    </span>
                                    <Button
                                      size='sm'
                                      variant='outline'
                                      disabled={busy !== null}
                                      onClick={() =>
                                        void restoreObservation(document.id, observation.id)
                                      }>
                                      {t('restoreObservation')}
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
