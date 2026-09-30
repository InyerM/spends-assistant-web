'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShortcutCreateForm } from '@/components/transactions/shortcut-create-form';
import { previewLuloNotice, type LuloNoticePreview } from '@/lib/shortcut-inbox/lulo-preview';

interface InboxItem {
  id: string;
  source: string;
  external_id: string | null;
  received_at: string;
  raw_text: string;
  status: 'pending' | 'non_transaction' | 'dismissed' | 'matched' | 'created';
  created_at: string;
  match?: { decision_id: string; transaction_id: string };
}

interface InboxList {
  data: InboxItem[];
  count: number;
}

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
    <div className='bg-muted/50 space-y-2 rounded-md border p-3 text-sm'>
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

export default function ShortcutInboxPage(): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/shortcut-inbox?page=${page}&limit=${PAGE_SIZE}&status=${filter}`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Could not load inbox');
      const result = (await response.json()) as InboxList;
      setItems(result.data);
      setCount(result.count);
      setError(null);
    } catch {
      setError(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filter, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, status: InboxItem['status']): Promise<void> => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/shortcut-inbox/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Review failed');
      await load();
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
    setCandidateErrorId(null);
    if (candidateById[id]) return;
    setCandidateBusyId(id);
    try {
      const response = await fetch(`/api/shortcut-inbox/${id}/candidates`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Candidate lookup failed');
      const result = (await response.json()) as CandidateResponse;
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
    <div className='mx-auto max-w-5xl space-y-6 p-4 sm:p-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='space-y-2'>
          <Button asChild variant='ghost' size='sm' className='-ml-2'>
            <Link href='/transactions'>
              <ArrowLeft /> {t('backToTransactions')}
            </Link>
          </Button>
          <h1 className='text-foreground text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-muted-foreground max-w-2xl text-sm'>{t('subtitle')}</p>
        </div>
        <Button asChild variant='outline'>
          <a href='/api/shortcut-inbox/export' download>
            <Download /> {t('exportJson')}
          </a>
        </Button>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3 border-b pb-4'>
        <label className='text-sm font-medium' htmlFor='inbox-status'>
          {t('statusFilter')}
        </label>
        <select
          id='inbox-status'
          className='border-input bg-background rounded-md border px-3 py-2 text-sm'
          value={filter}
          onChange={(event): void => {
            setFilter(event.target.value);
            setPage(1);
          }}>
          <option value='pending'>{t('pending')}</option>
          <option value='non_transaction'>{t('nonTransaction')}</option>
          <option value='dismissed'>{t('dismissed')}</option>
          <option value='matched'>{t('matched')}</option>
          <option value='created'>{t('created')}</option>
        </select>
      </div>

      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
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
        <div className='space-y-3'>
          {items.map((item) => {
            const candidateResult = candidateById[item.id];
            const luloPreview = previewLuloNotice(item.source, item.raw_text, item.received_at);
            return (
              <Card key={item.id}>
                <CardContent className='space-y-4 py-4'>
                  <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>{item.source}</Badge>
                      <Badge variant={item.status === 'pending' ? 'secondary' : 'outline'}>
                        {item.status === 'non_transaction' ? t('nonTransaction') : t(item.status)}
                      </Badge>
                    </div>
                    <time className='text-muted-foreground' dateTime={item.received_at}>
                      {formatDate(item.received_at)}
                    </time>
                  </div>
                  <p className='text-foreground text-sm leading-relaxed wrap-break-word whitespace-pre-wrap'>
                    {item.raw_text}
                  </p>
                  {luloPreview && <LuloPreview preview={luloPreview} />}
                  {(item.status === 'matched' || item.status === 'created') && item.match && (
                    <p className='text-muted-foreground text-xs'>
                      {item.status === 'created'
                        ? t('createdTransaction')
                        : t('matchedTransaction')}
                      : {item.match.transaction_id}
                    </p>
                  )}
                  <div className='flex flex-wrap gap-2 border-t pt-3'>
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
                    {item.status === 'pending' && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={(): void => void showCandidates(item.id)}>
                        {openCandidateId === item.id ? t('hideCandidates') : t('showCandidates')}
                      </Button>
                    )}
                    {item.status === 'pending' && !luloPreview && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={(): void =>
                          setCreateInboxId(createInboxId === item.id ? null : item.id)
                        }>
                        {t('createNew')}
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
                          variant='ghost'
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
                  {createInboxId === item.id && item.status === 'pending' && !luloPreview && (
                    <ShortcutCreateForm
                      inboxId={item.id}
                      receivedAt={item.received_at}
                      onCancel={(): void => setCreateInboxId(null)}
                      onCreated={(): void => {
                        setCreateInboxId(null);
                        setPage(1);
                        setFilter('created');
                      }}
                    />
                  )}
                  {openCandidateId === item.id && (
                    <div className='space-y-3 rounded-md border p-3 text-sm'>
                      {candidateBusyId === item.id && <p>{t('candidateLoading')}</p>}
                      {candidateErrorId === item.id && <p role='alert'>{t('candidateFailed')}</p>}
                      {candidateResult && (
                        <>
                          <p className='text-muted-foreground'>{t('candidateCaution')}</p>
                          {candidateResult.candidates.length === 0 && <p>{t('noCandidates')}</p>}
                          {candidateResult.candidates.map((candidate) => (
                            <div key={candidate.id} className='space-y-1 border-t pt-3'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <Badge variant='outline'>
                                  {candidate.strength === 'strong'
                                    ? t('strongSignal')
                                    : t('possibleMatch')}
                                </Badge>
                                <span>{candidate.description}</span>
                              </div>
                              <p className='text-muted-foreground'>
                                {candidate.date} · {candidate.amount} · {candidate.source}
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
        </div>
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
