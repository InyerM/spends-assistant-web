'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { HeartHandshake, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatLocalizedDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
import {
  reliefFundEventSchema,
  summarizeReliefFund,
  type ReliefFundEvent,
} from '@/lib/relief-funds/journal';

type EntryType = 'create_fund' | 'receipt' | 'outlay' | 'unknown_spend';
type SourceKind = 'ledger_transaction' | 'bank_notice' | 'cash' | 'receipt' | 'manual_recollection';

interface SavedEntry {
  id: string;
  kind: 'receipt' | 'outlay' | 'unknown_spend';
  occurred_on: string | null;
  amount_minor: string | null;
  description: string;
  source_kind: SourceKind;
  source_reference: string;
  transaction_id?: string | null;
}

interface SavedFund {
  id: string;
  title: string;
  purpose: string;
  currency: 'COP';
  relief_fund_entries: SavedEntry[];
}

interface Draft {
  entryType: EntryType;
  title: string;
  purpose: string;
  fundId: string;
  date: string;
  amount: string;
  description: string;
  sourceKind: SourceKind;
  sourceReference: string;
  transactionId: string;
}

const emptyDraft: Draft = {
  entryType: 'create_fund',
  title: '',
  purpose: '',
  fundId: '',
  date: '',
  amount: '',
  description: '',
  sourceKind: 'bank_notice',
  sourceReference: '',
  transactionId: '',
};

function amountLabel(value: string, locale: string): string {
  const negative = value.startsWith('-');
  const units = negative ? value.slice(1) : value;
  return `${negative ? '-' : ''}${formatLocalizedDecimalUnits(units, 2, locale)} COP`;
}

export default function ReliefFundsPage(): React.ReactElement {
  const t = useTranslations('wealth.reliefFunds');
  const locale = useLocale();
  const loadError = t('loadFailed');
  const [funds, setFunds] = useState<SavedFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [reviewEvent, setReviewEvent] = useState<ReliefFundEvent | null>(null);
  const [checked, setChecked] = useState(false);
  const requestId = useRef<string | null>(null);

  const loadFunds = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/relief-funds');
    if (!response.ok) throw new Error(loadError);
    const body = (await response.json()) as { data?: SavedFund[] };
    setFunds(body.data ?? []);
  }, [loadError]);

  useEffect(() => {
    void loadFunds()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : loadError);
      })
      .finally(() => setLoading(false));
  }, [loadFunds, loadError]);

  function change<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setReviewEvent(null);
    setChecked(false);
    requestId.current = null;
    setError(null);
  }

  function changeType(value: EntryType): void {
    const sourceKind: SourceKind =
      value === 'unknown_spend'
        ? 'manual_recollection'
        : value === 'outlay'
          ? 'cash'
          : 'bank_notice';
    setDraft((previous) => ({
      ...previous,
      entryType: value,
      sourceKind,
      amount: '',
      transactionId: '',
    }));
    setReviewEvent(null);
    setChecked(false);
    requestId.current = null;
    setError(null);
  }

  function buildEvent(): ReliefFundEvent {
    if (draft.entryType === 'create_fund') {
      return reliefFundEventSchema.parse({
        action: 'create_fund',
        title: draft.title.trim(),
        purpose: draft.purpose.trim(),
        currency: 'COP',
      });
    }
    const minor = draft.entryType === 'unknown_spend' ? null : parseDecimalUnits(draft.amount, 2);
    return reliefFundEventSchema.parse({
      action: 'add_entry',
      fund_id: draft.fundId,
      kind: draft.entryType,
      occurred_on: draft.date || null,
      amount_minor: minor,
      description: draft.description.trim(),
      source_kind: draft.sourceKind,
      source_reference: draft.sourceReference.trim(),
      transaction_id: draft.sourceKind === 'ledger_transaction' ? draft.transactionId.trim() : null,
    });
  }

  function review(): void {
    try {
      setReviewEvent(buildEvent());
      setChecked(false);
      requestId.current = crypto.randomUUID();
      setError(null);
    } catch {
      setError(t('checkSource'));
    }
  }

  async function confirm(): Promise<void> {
    if (!reviewEvent || !checked || !requestId.current) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/relief-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId.current, reviewed: true, event: reviewEvent }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? t('saveFailed'));
      }
      await loadFunds();
      setDraft(emptyDraft);
      setReviewEvent(null);
      setChecked(false);
      requestId.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className='mx-auto max-w-6xl space-y-6 p-4 sm:p-6'>
      <header className='space-y-2'>
        <div className='flex items-center gap-3'>
          <div className='bg-primary/10 text-primary rounded-xl p-2.5'>
            <HeartHandshake className='h-5 w-5' />
          </div>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>{t('title')}</h1>
            <p className='text-muted-foreground text-sm'>{t('subtitle')}</p>
          </div>
        </div>
        <p className='border-border bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm'>
          {t('journalNote')}
        </p>
      </header>

      {error && (
        <p
          role='alert'
          className='border-destructive/30 text-destructive rounded-lg border p-3 text-sm'>
          {error}
        </p>
      )}

      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]'>
        <section aria-label={t('savedFunds')} className='space-y-3'>
          <h2 className='text-lg font-semibold'>{t('savedFunds')}</h2>
          {loading ? (
            <p className='text-muted-foreground text-sm'>{t('loading')}</p>
          ) : funds.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                <p className='font-medium'>{t('empty')}</p>
                <p className='text-muted-foreground text-sm'>{t('emptyHint')}</p>
              </CardContent>
            </Card>
          ) : (
            funds.map((fund) => {
              const entries = [...fund.relief_fund_entries].sort(
                (a, b) =>
                  (b.occurred_on ?? '').localeCompare(a.occurred_on ?? '') ||
                  b.id.localeCompare(a.id),
              );
              const summary = summarizeReliefFund(entries);
              return (
                <Card key={fund.id}>
                  <CardHeader>
                    <CardTitle>{fund.title}</CardTitle>
                    <CardDescription>{fund.purpose}</CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='grid gap-2 text-sm sm:grid-cols-3'>
                      <p>
                        <span className='text-muted-foreground block text-xs'>{t('received')}</span>
                        {amountLabel(summary.receiptsMinor, locale)}
                      </p>
                      <p>
                        <span className='text-muted-foreground block text-xs'>
                          {t('knownOutlays')}
                        </span>
                        {amountLabel(summary.outlaysMinor, locale)}
                      </p>
                      <p>
                        <span className='text-muted-foreground block text-xs'>
                          {t('knownRemainder')}
                        </span>
                        {amountLabel(summary.knownRemainderMinor, locale)}
                      </p>
                    </div>
                    {!summary.actualRemainderKnown && (
                      <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm'>
                        {t('unknownRemainder', { count: summary.unknownSpendCount })}
                      </p>
                    )}
                    <ul className='divide-border divide-y text-sm'>
                      {entries.map((entry) => (
                        <li key={entry.id} className='flex flex-wrap justify-between gap-x-3 py-2'>
                          <span>
                            <span className='text-muted-foreground mr-2'>
                              {entry.occurred_on ?? t('dateUnknown')}
                            </span>
                            {entry.description}
                            <span className='text-muted-foreground block text-xs'>
                              {t(
                                `source${entry.source_kind
                                  .split('_')
                                  .map((part) => part[0].toUpperCase() + part.slice(1))
                                  .join('')}`,
                              )}{' '}
                              · {entry.source_reference}
                            </span>
                            {entry.transaction_id && (
                              <Link
                                href={`/transactions/${entry.transaction_id}`}
                                className='text-primary mt-1 block text-xs underline underline-offset-2'>
                                {t('viewTransaction')}
                              </Link>
                            )}
                          </span>
                          <span className='font-mono tabular-nums'>
                            {entry.amount_minor === null
                              ? t('amountUnknown')
                              : `${entry.kind === 'outlay' ? '-' : '+'}${amountLabel(entry.amount_minor, locale)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        <section aria-label={t('newEntry')}>
          <Card>
            <CardHeader>
              <CardTitle>{t('newEntry')}</CardTitle>
              <CardDescription>{t('entryHint')}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <label className='block space-y-1 text-sm'>
                {t('entryType')}
                <select
                  aria-label={t('entryType')}
                  className='border-input bg-background w-full rounded-md border p-2'
                  value={draft.entryType}
                  onChange={(event) => changeType(event.target.value as EntryType)}>
                  <option value='create_fund'>{t('createFund')}</option>
                  <option value='receipt'>{t('donationReceived')}</option>
                  <option value='outlay'>{t('knownPurchase')}</option>
                  <option value='unknown_spend'>{t('unknownSpend')}</option>
                </select>
              </label>
              {draft.entryType === 'create_fund' ? (
                <>
                  <label className='block space-y-1 text-sm'>
                    {t('fundTitle')}
                    <Input
                      aria-label={t('fundTitle')}
                      value={draft.title}
                      onChange={(event) => change('title', event.target.value)}
                    />
                  </label>
                  <label className='block space-y-1 text-sm'>
                    {t('purpose')}
                    <Input
                      aria-label={t('purpose')}
                      value={draft.purpose}
                      onChange={(event) => change('purpose', event.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className='block space-y-1 text-sm'>
                    {t('fund')}
                    <select
                      aria-label={t('fund')}
                      className='border-input bg-background w-full rounded-md border p-2'
                      value={draft.fundId}
                      onChange={(event) => change('fundId', event.target.value)}>
                      <option value=''>{t('selectFund')}</option>
                      {funds.map((fund) => (
                        <option key={fund.id} value={fund.id}>
                          {fund.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className='block space-y-1 text-sm'>
                    {draft.entryType === 'unknown_spend' ? t('optionalDate') : t('date')}
                    <Input
                      aria-label={
                        draft.entryType === 'unknown_spend' ? t('optionalDate') : t('date')
                      }
                      type='date'
                      value={draft.date}
                      onChange={(event) => change('date', event.target.value)}
                    />
                  </label>
                  {draft.entryType !== 'unknown_spend' && (
                    <label className='block space-y-1 text-sm'>
                      {t('exactAmount')}
                      <Input
                        aria-label={t('exactAmount')}
                        inputMode='decimal'
                        value={draft.amount}
                        onChange={(event) => change('amount', event.target.value)}
                      />
                    </label>
                  )}
                  <label className='block space-y-1 text-sm'>
                    {t('description')}
                    <Input
                      aria-label={t('description')}
                      value={draft.description}
                      onChange={(event) => change('description', event.target.value)}
                    />
                  </label>
                  <label className='block space-y-1 text-sm'>
                    {t('sourceType')}
                    <select
                      aria-label={t('sourceType')}
                      className='border-input bg-background w-full rounded-md border p-2'
                      value={draft.sourceKind}
                      onChange={(event) => {
                        change('sourceKind', event.target.value as SourceKind);
                        change('transactionId', '');
                      }}>
                      <option value='bank_notice'>{t('bankNotice')}</option>
                      <option value='cash'>{t('cash')}</option>
                      <option value='receipt'>{t('receipt')}</option>
                      <option value='manual_recollection'>{t('manualRecollection')}</option>
                      {draft.entryType !== 'unknown_spend' && (
                        <option value='ledger_transaction'>{t('ledgerTransaction')}</option>
                      )}
                    </select>
                  </label>
                  <label className='block space-y-1 text-sm'>
                    {t('sourceReference')}
                    <Input
                      aria-label={t('sourceReference')}
                      value={draft.sourceReference}
                      onChange={(event) => change('sourceReference', event.target.value)}
                    />
                  </label>
                  {draft.sourceKind === 'ledger_transaction' && (
                    <label className='block space-y-1 text-sm'>
                      {t('transactionId')}
                      <Input
                        aria-label={t('transactionId')}
                        value={draft.transactionId}
                        onChange={(event) => change('transactionId', event.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              <Button onClick={review} disabled={saving}>
                {t('reviewEntry')}
              </Button>
              {reviewEvent && (
                <div className='border-border space-y-3 rounded-lg border p-3 text-sm'>
                  <p className='font-medium'>{t('reviewBeforeSaving')}</p>
                  <p>
                    {reviewEvent.action === 'create_fund'
                      ? `${reviewEvent.title} · ${reviewEvent.purpose}`
                      : `${reviewEvent.occurred_on ?? t('dateUnknown')} · ${reviewEvent.description} · ${reviewEvent.amount_minor === null ? t('amountUnknown') : amountLabel(reviewEvent.amount_minor, locale)}`}
                  </p>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={checked}
                      onChange={(event) => setChecked(event.target.checked)}
                      aria-label={t('checked')}
                    />
                    {t('checked')}
                  </label>
                  <Button onClick={() => void confirm()} disabled={!checked || saving}>
                    {t('confirm')}
                  </Button>
                </div>
              )}
              <p className='text-muted-foreground flex items-start gap-2 text-xs'>
                <CircleAlert className='mt-0.5 h-3.5 w-3.5 shrink-0' />
                {t('reviewHint')}
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
