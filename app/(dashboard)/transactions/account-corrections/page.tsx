'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileSearch, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { accountKeys } from '@/lib/api/queries/account.queries';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';

interface Candidate {
  id: string;
  account_id: string;
  amount: number;
  date: string;
  time: string;
  description: string;
  raw_text: string;
  current_account_name: string;
  match_decision_id: string;
}

interface Destination {
  id: string;
  name: string;
}
interface ReviewList {
  data: Candidate[];
  destinations: Destination[];
}
const money = /^(0|[1-9][0-9]{0,12})(?:\.[0-9]{1,2})?$/u;

export default function AccountCorrectionsPage(): React.ReactElement {
  const t = useTranslations('accountCorrections');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Candidate[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [document, setDocument] = useState('');
  const [page, setPage] = useState('');
  const [line, setLine] = useState('');
  const [postedAmount, setPostedAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [success, setSuccess] = useState(false);
  const requestId = useRef<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch('/api/transactions/account-corrections', {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Correction review unavailable');
      const result = (await response.json()) as ReviewList;
      setItems(result.data);
      setDestinations(result.destinations);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const destination = destinations.at(0) ?? null;
  const statementPage = Number(page);
  const ready =
    !!selected &&
    !!destination &&
    document.trim().length > 0 &&
    document.trim().length <= 120 &&
    Number.isInteger(statementPage) &&
    statementPage >= 1 &&
    statementPage <= 999 &&
    line.trim().length > 0 &&
    line.trim().length <= 500 &&
    money.test(postedAmount) &&
    Number(postedAmount) > 0 &&
    confirmed &&
    !saving;

  function open(item: Candidate): void {
    setSelectedId(item.id);
    setDocument('');
    setPage('');
    setLine('');
    setPostedAmount(Number(item.amount).toFixed(2));
    setConfirmed(false);
    setSubmitError(false);
    setSuccess(false);
    requestId.current = null;
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    setSubmitError(false);
    try {
      requestId.current ??= crypto.randomUUID();
      const response = await fetch('/api/transactions/account-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId.current,
          transaction_id: selected.id,
          match_decision_id: selected.match_decision_id,
          expected_account_id: selected.account_id,
          expected_amount: Number(selected.amount).toFixed(2),
          new_account_id: destination.id,
          new_amount: Number(postedAmount) === Number(selected.amount) ? null : postedAmount,
          evidence: { document: document.trim(), page: statementPage, line: line.trim() },
        }),
      });
      if (!response.ok) throw new Error('Correction failed');
      setItems((current) => current.filter((item) => item.id !== selected.id));
      setSelectedId(null);
      setSuccess(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountKeys.all }),
        queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      ]);
    } catch {
      setSubmitError(true);
    } finally {
      setSaving(false);
    }
  }

  const formatAmount = (amount: number): string =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP' }).format(amount);

  return (
    <div className='mx-auto max-w-4xl space-y-6 p-4 pb-12 sm:p-6 lg:p-8'>
      <div className='space-y-3'>
        <Button asChild variant='ghost' size='sm' className='-ml-2'>
          <Link href='/transactions'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            {t('backToTransactions')}
          </Link>
        </Button>
        <div className='flex items-start gap-3'>
          <span className='bg-brand-secondary/10 text-brand-secondary rounded-lg p-2.5'>
            <FileSearch className='h-5 w-5' />
          </span>
          <div>
            <h1 className='text-3xl font-semibold tracking-tight'>{t('title')}</h1>
            <p className='text-muted-foreground mt-1 text-sm'>{t('subtitle')}</p>
          </div>
        </div>
      </div>

      <div className='bg-muted/40 border-border flex gap-3 rounded-lg border p-4 text-sm'>
        <ShieldCheck className='text-brand-secondary mt-0.5 h-4 w-4 shrink-0' />
        <p>{t('evidenceCaution')}</p>
      </div>
      {success && (
        <p role='status' className='text-success text-sm'>
          {t('success')}
        </p>
      )}
      {loadError && (
        <p role='alert' className='text-destructive text-sm'>
          {t('loadFailed')}
        </p>
      )}
      {loading ? (
        <p className='text-muted-foreground text-sm'>{t('loading')}</p>
      ) : items.length === 0 ? (
        <div className='border-border bg-card rounded-xl border px-5 py-10 text-center'>
          <p className='text-muted-foreground text-sm'>{t('noCandidates')}</p>
        </div>
      ) : (
        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>{t('found', { count: items.length })}</p>
          {items.map((item) => (
            <section key={item.id} className='border-border bg-card rounded-xl border p-5'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <p className='text-muted-foreground text-xs'>
                    {item.date} · {item.time.slice(0, 5)}
                  </p>
                  <h2 className='mt-1 font-medium'>{item.description}</h2>
                </div>
                <p className='font-semibold tabular-nums'>{formatAmount(item.amount)}</p>
              </div>
              <div className='bg-muted/40 mt-4 grid gap-3 rounded-lg p-3 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center'>
                <div>
                  <p className='text-muted-foreground text-xs'>{t('currentAccount')}</p>
                  <p className='font-medium'>{item.current_account_name}</p>
                </div>
                <ArrowRight aria-hidden='true' className='text-muted-foreground h-4 w-4' />
                <div>
                  <p className='text-muted-foreground text-xs'>{t('confirmedAccount')}</p>
                  <p className='font-medium'>{destination?.name ?? t('destinationUnavailable')}</p>
                </div>
              </div>
              <details className='mt-3 text-sm'>
                <summary className='cursor-pointer font-medium'>{t('sourceNotice')}</summary>
                <p className='text-muted-foreground mt-2 break-words'>{item.raw_text}</p>
              </details>
              {selectedId !== item.id ? (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='mt-4'
                  onClick={(): void => open(item)}>
                  {t('reviewPosting')}
                </Button>
              ) : (
                <form
                  onSubmit={(event): void => {
                    void submit(event);
                  }}
                  className='mt-5 space-y-4 border-t pt-5'>
                  <p className='text-muted-foreground text-sm'>{t('formCaution')}</p>
                  <div className='grid gap-4 sm:grid-cols-2'>
                    <label className='space-y-1.5 text-sm' htmlFor='statement-document'>
                      <span>{t('statementDocument')}</span>
                      <input
                        id='statement-document'
                        value={document}
                        onChange={(event): void => setDocument(event.target.value)}
                        maxLength={120}
                        className='border-input bg-background w-full rounded-md border px-3 py-2'
                      />
                    </label>
                    <label className='space-y-1.5 text-sm' htmlFor='statement-page'>
                      <span>{t('statementPage')}</span>
                      <input
                        id='statement-page'
                        type='number'
                        min='1'
                        max='999'
                        value={page}
                        onChange={(event): void => setPage(event.target.value)}
                        className='border-input bg-background w-full rounded-md border px-3 py-2'
                      />
                    </label>
                    <label className='space-y-1.5 text-sm sm:col-span-2' htmlFor='statement-line'>
                      <span>{t('statementLine')}</span>
                      <input
                        id='statement-line'
                        value={line}
                        onChange={(event): void => setLine(event.target.value)}
                        maxLength={500}
                        className='border-input bg-background w-full rounded-md border px-3 py-2'
                      />
                    </label>
                    <label className='space-y-1.5 text-sm' htmlFor='posted-amount'>
                      <span>{t('postedAmount')}</span>
                      <input
                        id='posted-amount'
                        value={postedAmount}
                        inputMode='decimal'
                        onChange={(event): void => setPostedAmount(event.target.value)}
                        className='border-input bg-background w-full rounded-md border px-3 py-2 tabular-nums'
                      />
                    </label>
                  </div>
                  <label className='flex items-start gap-2 text-sm' htmlFor='confirm-evidence'>
                    <input
                      id='confirm-evidence'
                      type='checkbox'
                      checked={confirmed}
                      onChange={(event): void => setConfirmed(event.target.checked)}
                      className='mt-1'
                    />
                    <span>{t('confirmedEvidence')}</span>
                  </label>
                  {submitError && (
                    <p role='alert' className='text-destructive text-sm'>
                      {t('saveFailed')}
                    </p>
                  )}
                  <div className='flex gap-2'>
                    <Button type='submit' disabled={!ready}>
                      {saving ? t('saving') : t('applyCorrection')}
                    </Button>
                    <Button type='button' variant='ghost' onClick={(): void => setSelectedId(null)}>
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
