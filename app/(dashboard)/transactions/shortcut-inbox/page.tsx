'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useShortcutInbox } from '@/lib/api/queries/shortcut-inbox.queries';
import { PeriodSelector } from '@/components/transactions/period-selector';
import { SearchInput } from '@/components/shared/search-input';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShortcutCreateForm } from '@/components/transactions/shortcut-create-form';
import { ForwardedEmailEvidence } from '@/components/transactions/forwarded-email-evidence';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { AiConsentRequiredError, type AiConsentScope } from '@/lib/ai-consent';
import { previewLuloNotice, type LuloNoticePreview } from '@/lib/shortcut-inbox/lulo-preview';
import {
  useAnalyzeForwardedEmail,
  type ForwardedEmailAnalysis,
} from '@/lib/api/mutations/shortcut-inbox.mutations';

import type { InboxItem } from '@/types/shortcut-inbox';

interface Candidate {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: string;
  source: string;
  strength: 'strong' | 'possible';
  signals: Array<'exact_raw_text' | 'same_amount_date_account'>;
}

interface CandidateResponse {
  evidence: { amount: string | null; date: string | null; account: string };
  candidates: Candidate[];
  at_limit: boolean;
}

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function formatBogotaDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(value));
}

function LuloPreview({ preview }: { preview: LuloNoticePreview }): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const kindLabel = {
    card_purchase: 'luloCardPurchase',
    zero_amount_authorization: 'luloZeroAmount',
    needs_review: 'luloNeedsReview',
  } as const;
  return (
    <div className='bg-muted/50 border-border space-y-2 rounded-md border p-3 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='secondary'>{t(kindLabel[preview.kind])}</Badge>
        <span className='text-muted-foreground text-xs'>
          {t(preview.confidence === 'structured' ? 'luloStructured' : 'luloLow')}
        </span>
      </div>
      <dl className='grid gap-x-4 gap-y-2 sm:grid-cols-2'>
        <div>
          <dt className='text-muted-foreground'>{t('luloEmailTime')}</dt>
          <dd>{formatBogotaDate(preview.messageReceivedAt)}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('luloBankTime')}</dt>
          <dd>{preview.bankEventAt ? formatBogotaDate(preview.bankEventAt) : '—'}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('luloMerchant')}</dt>
          <dd>{preview.merchant ?? '—'}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('luloCard')}</dt>
          <dd>{preview.cardLastFour ?? '—'}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>{t('luloOriginalAmount')}</dt>
          <dd>{preview.amountText ?? '—'}</dd>
        </div>
      </dl>
      <p className='text-muted-foreground text-xs'>{t('luloCurrencyUnknown')}</p>
      <p className='text-muted-foreground text-xs'>{t('luloCaution')}</p>
      {preview.kind === 'zero_amount_authorization' && (
        <p className='text-sm font-medium'>{t('luloZeroCaution')}</p>
      )}
      <details className='text-xs'>
        <summary className='cursor-pointer font-medium'>{t('luloEvidence')}</summary>
        <pre className='mt-2 overflow-x-auto break-all whitespace-pre-wrap'>
          {Object.values(preview.excerpts).filter(Boolean).join('\n')}
        </pre>
      </details>
    </div>
  );
}

export default function ShortcutInboxPage({
  source,
  itemId,
}: {
  source?: 'forwarded_email';
  itemId?: string;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('pending');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  useEffect(() => {
    if (searchText.trim() === search) return;
    const timeout = setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return (): void => clearTimeout(timeout);
  }, [searchText, search]);
  const inbox = useShortcutInbox({
    page,
    item_id: itemId,
    status: filter,
    source,
    search,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const items = inbox.data?.data ?? [];
  const count = inbox.data?.count ?? 0;
  const loading = inbox.isPending;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentRequired, setConsentRequired] = useState<AiConsentScope | null>(null);
  const [candidateById, setCandidateById] = useState<Partial<Record<string, CandidateResponse>>>(
    {},
  );
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);
  const [candidateBusyId, setCandidateBusyId] = useState<string | null>(null);
  const [candidateErrorId, setCandidateErrorId] = useState<string | null>(null);
  const [reviewCandidate, setReviewCandidate] = useState<{
    inboxId: string;
    transactionId: string;
  } | null>(null);
  const [matchBusyId, setMatchBusyId] = useState<string | null>(null);
  const [matchErrorId, setMatchErrorId] = useState<string | null>(null);
  const [reverseInboxId, setReverseInboxId] = useState<string | null>(null);
  const [reverseBusyId, setReverseBusyId] = useState<string | null>(null);
  const [reverseErrorId, setReverseErrorId] = useState<string | null>(null);
  const [createInboxId, setCreateInboxId] = useState<string | null>(null);
  const [analysisById, setAnalysisById] = useState<Record<string, ForwardedEmailAnalysis>>({});
  const [analysisBusyIds, setAnalysisBusyIds] = useState<Set<string>>(() => new Set());
  const analysisMutation = useAnalyzeForwardedEmail();

  const openCreateReview = async (item: InboxItem): Promise<void> => {
    if (createInboxId === item.id) {
      setCreateInboxId(null);
      return;
    }
    setCreateInboxId(item.id);
    setOpenCandidateId(item.id);
    void loadCandidates(item.id);
    if (item.source === 'forwarded_email') {
      setAnalysisBusyIds((current) => new Set(current).add(item.id));
      setConsentRequired(null);
      try {
        const analysis = await analysisMutation.mutateAsync(item.id);
        setAnalysisById((current) => ({ ...current, [item.id]: analysis }));
      } catch (cause) {
        if (cause instanceof AiConsentRequiredError) setConsentRequired(cause.scope);
        else setError(t('reanalyzeFailed'));
      } finally {
        setAnalysisBusyIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    }
  };

  const review = async (id: string, status: InboxItem['status']): Promise<void> => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/shortcut-inbox/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Review failed');
      await Promise.all([
        inbox.refetch(),
        queryClient.invalidateQueries({ queryKey: ['documents'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    } catch {
      setError(t('saveFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const showCandidates = async (id: string): Promise<void> => {
    if (openCandidateId === id) {
      setOpenCandidateId(null);
      return;
    }
    setOpenCandidateId(id);
    await loadCandidates(id);
  };

  const loadCandidates = async (id: string): Promise<void> => {
    setCandidateErrorId(null);
    setCandidateBusyId(id);
    try {
      const response = await fetch(`/api/shortcut-inbox/${id}/candidates`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Candidate lookup failed');
      const result = (await response.json()) as CandidateResponse;
      if (!Array.isArray(result.candidates)) throw new Error('Invalid candidate response');
      setCandidateById((current) => ({ ...current, [id]: result }));
    } catch {
      setCandidateErrorId(id);
    } finally {
      setCandidateBusyId(null);
    }
  };

  const acknowledgeMatch = async (inboxId: string, transactionId: string): Promise<void> => {
    setMatchBusyId(inboxId);
    setMatchErrorId(null);
    try {
      const response = await fetch(`/api/shortcut-inbox/${inboxId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      if (!response.ok) throw new Error('Match acknowledgement failed');
      setReviewCandidate(null);
      setOpenCandidateId(null);
      setPage(1);
      setFilter('matched');
    } catch {
      setMatchErrorId(inboxId);
    } finally {
      setMatchBusyId(null);
    }
  };

  const reverseMatch = async (inboxId: string, decisionId: string): Promise<void> => {
    setReverseBusyId(inboxId);
    setReverseErrorId(null);
    try {
      const response = await fetch(`/api/shortcut-inbox/${inboxId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_id: decisionId }),
      });
      if (!response.ok) throw new Error('Match reversal failed');
      setReverseInboxId(null);
      setPage(1);
      setFilter('pending');
    } catch {
      setReverseErrorId(inboxId);
    } finally {
      setReverseBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className='mx-auto max-w-5xl space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='space-y-2'>
          <Button asChild variant='ghost' size='sm' className='-ml-2'>
            <Link href={itemId ? '/inbox' : source ? '/dashboard' : '/transactions'}>
              <ArrowLeft />{' '}
              {t(itemId ? 'backToInbox' : source ? 'backToDashboard' : 'backToTransactions')}
            </Link>
          </Button>
          <h1 className='text-foreground text-3xl font-semibold tracking-tight'>
            {t(source ? 'emailTitle' : 'title')}
          </h1>
          <p className='text-muted-foreground max-w-2xl text-sm'>
            {t(source ? 'emailSubtitle' : 'subtitle')}
          </p>
        </div>
        {!source && (
          <Button asChild variant='outline'>
            <a href='/api/shortcut-inbox/export' download>
              <Download /> {t('exportJson')}
            </a>
          </Button>
        )}
      </div>

      <div
        className={
          itemId
            ? 'hidden'
            : 'border-border bg-card grid gap-4 rounded-xl border p-4 sm:grid-cols-2'
        }>
        <form
          className='flex min-w-0 items-center gap-2 sm:col-span-2'
          onSubmit={(event): void => {
            event.preventDefault();
            setPage(1);
            setSearch(searchText.trim());
          }}>
          <SearchInput
            value={searchText}
            onChange={(value): void => {
              setSearchText(value);
              if (!value) {
                setSearch('');
                setPage(1);
              }
            }}
            placeholder={t('searchPlaceholder')}
            clearLabel={t('clearSearch')}
            className='min-w-0 flex-1'
          />
          <Button type='submit' variant='outline'>
            {t('searchAction')}
          </Button>
        </form>
        <div className='min-w-0 space-y-2'>
          <label className='text-sm font-medium'>{t('statusFilter')}</label>
          <Select
            value={filter}
            onValueChange={(value): void => {
              setFilter(value);
              setPage(1);
            }}>
            <SelectTrigger className='w-full' aria-label={t('statusFilter')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='pending'>{t('pending')}</SelectItem>
              <SelectItem value='non_transaction'>{t('nonTransaction')}</SelectItem>
              <SelectItem value='dismissed'>{t('dismissed')}</SelectItem>
              <SelectItem value='matched'>{t('matched')}</SelectItem>
              <SelectItem value='created'>{t('created')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {source === 'forwarded_email' && (
          <div className='flex min-w-0 flex-wrap items-start gap-2'>
            <div className='w-full space-y-2 text-sm'>
              <p className='font-medium'>{t('receivedPeriod')}</p>
              <div className='border-border rounded-md border [&_button]:min-h-9 [&_button]:w-full [&_button]:justify-start'>
                <PeriodSelector
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  emptyLabel={t('allDates')}
                  onChange={(from, to): void => {
                    setDateFrom(from);
                    setDateTo(to);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant='outline'
                onClick={(): void => {
                  setDateFrom('');
                  setDateTo('');
                  setPage(1);
                }}>
                {t('clearDates')}
              </Button>
            )}
            <p className='text-muted-foreground w-full text-xs'>{t('receivedDateHint')}</p>
          </div>
        )}
      </div>
      {(error || inbox.isError) && (
        <p role='alert' className='text-destructive text-sm'>
          {error ?? t('loadFailed')}
        </p>
      )}
      {source === 'forwarded_email' ? (
        <details className='text-muted-foreground text-xs leading-5'>
          <summary className='cursor-pointer'>{t('reviewHelpTitle')}</summary>
          <p className='mt-2 max-w-3xl'>{t('reviewStatusHelp')}</p>
        </details>
      ) : null}
      {consentRequired && <AiConsentNotice scope={consentRequired} />}
      <div className='text-muted-foreground min-h-5 text-xs' role='status' aria-live='polite'>
        {inbox.isFetching && !loading ? t('refreshing') : null}
      </div>
      {loading ? (
        <p className='text-muted-foreground text-sm'>{t('loading')}</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-2 py-12 text-center'>
            <Inbox className='text-muted-foreground size-8' />
            <p className='font-medium'>{t('emptyTitle')}</p>
            <p className='text-muted-foreground text-sm'>{t('emptyDescription')}</p>
          </CardContent>
        </Card>
      ) : (
        <fieldset
          className='min-w-0 space-y-3'
          disabled={inbox.isPlaceholderData}
          aria-busy={inbox.isFetching}>
          {items.map((item) => {
            const candidateResult = candidateById[item.id];
            const luloPreview = previewLuloNotice(item.source, item.raw_text, item.received_at);
            const hasAttachments = Boolean(item.attachments?.length);
            const historicalLulo = item.source === 'lulo-email-backfill';
            return (
              <Card key={item.id} id={`inbox-${item.id}`}>
                <CardContent className='space-y-4 py-4'>
                  <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>
                        {item.source === 'forwarded_email' ? t('forwardedSource') : item.source}
                      </Badge>
                      <Badge
                        variant={item.status === 'pending' ? 'secondary' : 'outline'}
                        className={
                          item.status === 'pending'
                            ? 'border-brand-secondary/30 bg-brand-secondary/15 text-brand-secondary'
                            : item.status === 'created' || item.status === 'matched'
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : item.status === 'dismissed'
                                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                : 'border-border bg-muted text-muted-foreground'
                        }>
                        {item.status === 'non_transaction' ? t('nonTransaction') : t(item.status)}
                      </Badge>
                    </div>
                    <time className='text-muted-foreground' dateTime={item.received_at}>
                      {formatDate(item.received_at)}
                    </time>
                  </div>
                  <ForwardedEmailEvidence source={item.source} rawText={item.raw_text} />
                  {hasAttachments && (
                    <div className='border-border space-y-2 rounded-lg border p-3'>
                      <p className='text-muted-foreground text-sm'>{t('pdfReviewHint')}</p>
                      <div className='flex flex-wrap gap-2'>
                        {item.attachments?.map((attachment) => (
                          <Button key={attachment.id} variant='outline' size='sm' asChild>
                            <Link href={`/documents#document-${attachment.id}`}>
                              <FileText className='size-4' />
                              {attachment.file_name}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {luloPreview && <LuloPreview preview={luloPreview} />}
                  {(item.status === 'matched' || item.status === 'created') && item.match && (
                    <p className='text-primary text-xs'>
                      {item.status === 'created'
                        ? t('createdTransaction')
                        : t('matchedTransaction')}
                      : {item.match.transaction_id}
                    </p>
                  )}
                  <div className='border-border flex flex-wrap gap-2 border-t pt-3'>
                    {item.status === 'matched' && item.match && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={(): void => {
                          setReverseErrorId(null);
                          setReverseInboxId(reverseInboxId === item.id ? null : item.id);
                        }}>
                        {t('reviewReversal')}
                      </Button>
                    )}
                    {item.status === 'pending' && !hasAttachments && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={(): void => void showCandidates(item.id)}>
                        {openCandidateId === item.id ? t('hideCandidates') : t('showCandidates')}
                      </Button>
                    )}
                    {item.status === 'pending' && !historicalLulo && !hasAttachments && (
                      <Button
                        size='sm'
                        disabled={analysisBusyIds.has(item.id)}
                        onClick={(): void => void openCreateReview(item)}>
                        {t(item.source === 'forwarded_email' ? 'reanalyzeEmail' : 'createNew')}
                      </Button>
                    )}
                    {item.status !== 'pending' &&
                      item.status !== 'matched' &&
                      item.status !== 'created' && (
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={busyId === item.id}
                          onClick={(): void => void review(item.id, 'pending')}>
                          {t('returnToPending')}
                        </Button>
                      )}
                    {item.status !== 'non_transaction' &&
                      item.status !== 'matched' &&
                      item.status !== 'created' && (
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={busyId === item.id}
                          onClick={(): void => void review(item.id, 'non_transaction')}>
                          {t('markNonTransaction')}
                        </Button>
                      )}
                    {item.status !== 'dismissed' &&
                      item.status !== 'matched' &&
                      item.status !== 'created' && (
                        <Button
                          size='sm'
                          variant='destructive'
                          disabled={busyId === item.id}
                          onClick={(): void => void review(item.id, 'dismissed')}>
                          {t('dismiss')}
                        </Button>
                      )}
                  </div>
                  {item.status === 'matched' && item.match && reverseInboxId === item.id && (
                    <div className='bg-muted space-y-2 rounded-md p-3 text-sm'>
                      <p>{t('reversalCaution')}</p>
                      {reverseErrorId === item.id && <p role='alert'>{t('reversalFailed')}</p>}
                      <div className='flex flex-wrap gap-2'>
                        <Button
                          size='sm'
                          disabled={reverseBusyId === item.id}
                          onClick={(): void => void reverseMatch(item.id, item.match!.decision_id)}>
                          {t('reverseMatch')}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={reverseBusyId === item.id}
                          onClick={(): void => setReverseInboxId(null)}>
                          {t('cancelReversal')}
                        </Button>
                      </div>
                    </div>
                  )}
                  {createInboxId === item.id && item.status === 'pending' && !historicalLulo && (
                    <ShortcutCreateForm
                      inboxId={item.id}
                      rawText={item.raw_text}
                      receivedAt={item.received_at}
                      preview={luloPreview}
                      analysis={analysisById[item.id]}
                      analyzing={analysisBusyIds.has(item.id)}
                      onCancel={(): void => setCreateInboxId(null)}
                      onCreated={(): void => {
                        setCreateInboxId(null);
                        setPage(1);
                        setFilter('created');
                      }}
                    />
                  )}
                  {openCandidateId === item.id && (
                    <div className='border-border bg-muted/20 space-y-3 rounded-lg border p-4 text-sm'>
                      {candidateBusyId === item.id && <p>{t('candidateLoading')}</p>}
                      {candidateErrorId === item.id && <p role='alert'>{t('candidateFailed')}</p>}
                      {candidateResult && (
                        <>
                          <p className='text-muted-foreground'>{t('candidateCaution')}</p>
                          {candidateResult.candidates.length === 0 && <p>{t('noCandidates')}</p>}
                          {candidateResult.candidates.map((candidate) => (
                            <div
                              key={candidate.id}
                              className='border-border space-y-2 border-t pt-3'>
                              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                                <Badge variant='outline'>
                                  {candidate.strength === 'strong'
                                    ? t('strongSignal')
                                    : t('possibleMatch')}
                                </Badge>
                                <span className='min-w-0 font-medium break-words'>
                                  {candidate.description}
                                </span>
                              </div>
                              <p className='text-muted-foreground'>
                                {candidate.date} ·{' '}
                                {new Intl.NumberFormat(undefined, {
                                  style: 'currency',
                                  currency: 'COP',
                                  maximumFractionDigits: 2,
                                }).format(candidate.amount)}
                              </p>
                              {item.status === 'pending' &&
                                (reviewCandidate?.inboxId === item.id &&
                                reviewCandidate.transactionId === candidate.id ? (
                                  <div className='bg-muted space-y-2 rounded-md p-3'>
                                    <p>{t('matchConfirmCaution')}</p>
                                    {matchErrorId === item.id && (
                                      <p role='alert'>{t('matchFailed')}</p>
                                    )}
                                    <div className='flex flex-wrap gap-2'>
                                      <Button
                                        size='sm'
                                        disabled={matchBusyId === item.id}
                                        onClick={(): void =>
                                          void acknowledgeMatch(item.id, candidate.id)
                                        }>
                                        {t('acknowledgeMatch')}
                                      </Button>
                                      <Button
                                        size='sm'
                                        variant='outline'
                                        disabled={matchBusyId === item.id}
                                        onClick={(): void => setReviewCandidate(null)}>
                                        {t('cancelMatch')}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={(): void =>
                                      setReviewCandidate({
                                        inboxId: item.id,
                                        transactionId: candidate.id,
                                      })
                                    }>
                                    {t('reviewMatch')}
                                  </Button>
                                ))}
                              <p className='text-muted-foreground'>
                                {candidate.signals
                                  .map((signal) =>
                                    signal === 'exact_raw_text'
                                      ? t('exactRawText')
                                      : t('sameAmountDateAccount'),
                                  )
                                  .join('; ')}
                              </p>
                            </div>
                          ))}
                          {candidateResult.at_limit && <p>{t('candidateLimit')}</p>}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </fieldset>
      )}

      <div className='flex items-center justify-between gap-3 text-sm'>
        <span className='text-muted-foreground'>{t('countPage', { count, page, totalPages })}</span>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='icon-sm'
            aria-label={t('previousPage')}
            disabled={page <= 1}
            onClick={(): void => setPage((value) => value - 1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant='outline'
            size='icon-sm'
            aria-label={t('nextPage')}
            disabled={page >= totalPages}
            onClick={(): void => setPage((value) => value + 1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
