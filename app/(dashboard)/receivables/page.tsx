'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatLocalizedDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
import {
  receivableEventSchema,
  type ReceivableEventDraft,
} from '@/lib/wealth/personal-receivables';

interface SavedReceivable {
  id: string;
  borrower: string;
  label: string;
  currency: string;
  money_scale: number;
  outstanding_minor: string;
  personal_receivable_events?: {
    id: string;
    kind: 'disbursement' | 'repayment';
    occurred_on: string;
    amount_minor: string;
    source_transaction_id: string;
  }[];
}

interface SourceTransaction {
  id: string;
  date: string;
  amount: number;
  type: 'expense' | 'income';
  description: string;
}

type Action = ReceivableEventDraft['action'];
interface Draft {
  action: Action;
  borrower: string;
  label: string;
  currency: string;
  moneyScale: string;
  receivableId: string;
  date: string;
  amount: string;
  sourceTransactionId: string;
  evidenceReference: string;
}

const emptyDraft: Draft = {
  action: 'create_receivable',
  borrower: '',
  label: '',
  currency: '',
  moneyScale: '',
  receivableId: '',
  date: '',
  amount: '',
  sourceTransactionId: '',
  evidenceReference: '',
};

function displayMoney(amount: string, receivable: SavedReceivable, locale: string): string {
  return `${formatLocalizedDecimalUnits(amount, receivable.money_scale, locale)} ${receivable.currency}`;
}

export default function ReceivablesPage(): React.ReactElement {
  const t = useTranslations('wealth.receivables');
  const locale = useLocale();
  const loadError = t('loadFailed');
  const [receivables, setReceivables] = useState<SavedReceivable[]>([]);
  const [transactions, setTransactions] = useState<SourceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [preview, setPreview] = useState<ReceivableEventDraft | null>(null);
  const [checked, setChecked] = useState(false);
  const requestId = useRef<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/receivables');
    if (!response.ok) throw new Error(loadError);
    const body = (await response.json()) as { data?: SavedReceivable[] };
    setReceivables(body.data ?? []);
  }, [loadError]);

  useEffect(() => {
    void load()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : loadError))
      .finally(() => setLoading(false));
  }, [load, loadError]);

  function change<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((old) => ({
      ...old,
      [key]: value,
      ...(key === 'date' || key === 'action' ? { sourceTransactionId: '' } : {}),
    }));
    if (key === 'date' || key === 'action') setTransactions([]);
    setPreview(null);
    setChecked(false);
    requestId.current = null;
    setError(null);
  }

  const selected = receivables.find((item) => item.id === draft.receivableId);

  async function findTransactions(): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.action === 'create_receivable') {
      setError(t('dateRequired'));
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const type = draft.action === 'disbursement' ? 'expense' : 'income';
      const query = new URLSearchParams({
        date_from: draft.date,
        date_to: draft.date,
        type,
        limit: '100',
      });
      const response = await fetch(`/api/transactions?${query.toString()}`);
      if (!response.ok) throw new Error(t('findFailed'));
      const body = (await response.json()) as { data?: SourceTransaction[] };
      setTransactions(body.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('findFailed'));
    } finally {
      setSearching(false);
    }
  }

  function build(): ReceivableEventDraft {
    if (draft.action === 'create_receivable') {
      if (!/^[0-2]$/.test(draft.moneyScale)) throw new Error(t('scaleRequired'));
      return receivableEventSchema.parse({
        action: draft.action,
        borrower: draft.borrower,
        label: draft.label,
        currency: draft.currency.trim().toUpperCase(),
        money_scale: Number(draft.moneyScale),
      });
    }
    if (!selected) throw new Error(t('selectReceivableError'));
    const transaction = transactions.find((item) => item.id === draft.sourceTransactionId);
    if (!transaction) throw new Error(t('selectTransactionError'));
    const amountMinor = parseDecimalUnits(draft.amount, selected.money_scale);
    if (amountMinor !== parseDecimalUnits(String(transaction.amount), selected.money_scale))
      throw new Error(t('amountMismatch'));
    if (
      transaction.date !== draft.date ||
      transaction.type !== (draft.action === 'disbursement' ? 'expense' : 'income')
    )
      throw new Error(t('dateMismatch'));
    if (draft.action === 'repayment' && BigInt(amountMinor) > BigInt(selected.outstanding_minor))
      throw new Error(t('repaymentExceeds'));
    return receivableEventSchema.parse({
      action: draft.action,
      receivable_id: selected.id,
      source_transaction_id: transaction.id,
      occurred_on: draft.date,
      amount_minor: amountMinor,
      evidence_reference: draft.evidenceReference,
    });
  }

  function review(): void {
    try {
      setPreview(build());
      setChecked(false);
      requestId.current = crypto.randomUUID();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('checkSource'));
    }
  }

  async function confirm(): Promise<void> {
    if (!preview || !checked || !requestId.current) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/receivables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId.current, reviewed: true, event: preview }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? t('saveFailed'));
      }
      await load();
      setDraft(emptyDraft);
      setTransactions([]);
      setPreview(null);
      setChecked(false);
      requestId.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof Draft, placeholder = ''): React.ReactElement => (
    <label className='block space-y-2 text-sm font-medium' key={key}>
      {label}
      <Input
        value={draft[key]}
        onChange={(event) => change(key, event.target.value as never)}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <main className='mx-auto max-w-[1480px] space-y-8 p-4 sm:p-8 lg:p-10'>
      <header className='space-y-4'>
        <div className='flex items-center gap-3'>
          <HandCoins className='text-success h-6 w-6' />
          <h1 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{t('title')}</h1>
        </div>
        <p className='text-muted-foreground text-sm'>{t('subtitle')}</p>
        <p className='border-border text-muted-foreground max-w-4xl border-t pt-4 text-sm leading-relaxed'>
          {t('journalNote')}{' '}
          <Link href='/loans' className='underline'>
            {t('loansLink')}
          </Link>
          .
        </p>
      </header>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <div className='grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:gap-8'>
        <section className='min-w-0 space-y-4' aria-label={t('section')}>
          <h2 className='text-lg font-semibold tracking-tight'>{t('section')}</h2>
          {loading ? (
            <p>{t('loading')}</p>
          ) : receivables.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>{t('empty')}</CardContent>
            </Card>
          ) : (
            receivables.map((item) => (
              <Card key={item.id} className='min-w-0 gap-4 overflow-hidden'>
                <CardHeader>
                  <CardTitle className='min-w-0 text-lg leading-snug break-words'>
                    {item.label}
                  </CardTitle>
                  <p className='text-muted-foreground text-sm'>
                    {item.borrower} · {item.currency}
                  </p>
                </CardHeader>
                <CardContent className='space-y-4 text-sm'>
                  <p>
                    {t('outstanding')}{' '}
                    <strong className='text-foreground mt-1 block text-2xl font-semibold tracking-tight tabular-nums'>
                      {displayMoney(item.outstanding_minor, item, locale)}
                    </strong>
                  </p>
                  {(item.personal_receivable_events ?? []).map((event) => (
                    <p key={event.id} className='border-border border-t pt-4'>
                      {event.occurred_on} ·{' '}
                      {event.kind === 'disbursement' ? t('lent') : t('repaid')}{' '}
                      {displayMoney(event.amount_minor, item, locale)} ·{' '}
                      <Link
                        href={`/transactions/${event.source_transaction_id}`}
                        className='text-success hover:text-success/80 focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none'
                        aria-label={`${t('viewTransaction')} ${event.source_transaction_id.slice(0, 8)}`}>
                        {t('transaction')} {event.source_transaction_id.slice(0, 8)}
                      </Link>
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </section>
        <Card>
          <CardHeader>
            <CardTitle className='text-lg leading-snug break-words'>{t('newEntry')}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <label className='block space-y-2 text-sm font-medium'>
              {t('entryType')}
              <Select
                value={draft.action}
                onValueChange={(value) => change('action', value as Action)}>
                <SelectTrigger aria-label={t('entryType')} className='h-11 w-full min-w-0'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='create_receivable'>{t('createBorrower')}</SelectItem>
                  <SelectItem value='disbursement'>{t('moneyLent')}</SelectItem>
                  <SelectItem value='repayment'>{t('principalRepayment')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {draft.action === 'create_receivable' ? (
              <>
                {field(t('borrower'), 'borrower')}
                {field(t('loanLabel'), 'label')}
                {field(t('currency'), 'currency', 'COP')}
                {field(t('decimalPlaces'), 'moneyScale', t('forCop'))}
              </>
            ) : (
              <>
                <label className='block space-y-2 text-sm font-medium'>
                  {t('receivable')}
                  <Select
                    value={draft.receivableId || '__none__'}
                    onValueChange={(value) =>
                      change('receivableId', value === '__none__' ? '' : value)
                    }>
                    <SelectTrigger aria-label={t('receivable')} className='h-11 w-full min-w-0'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>{t('selectReceivable')}</SelectItem>
                      {receivables.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label} · {item.borrower}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {field(t('eventDate'), 'date', 'YYYY-MM-DD')}
                <Button
                  type='button'
                  variant='outline'
                  disabled={searching}
                  onClick={() => void findTransactions()}>
                  {searching ? t('searching') : t('findTransaction')}
                </Button>
                <label className='block space-y-2 text-sm font-medium'>
                  {t('sourceTransaction')}
                  <Select
                    value={draft.sourceTransactionId || '__none__'}
                    onValueChange={(value) =>
                      change('sourceTransactionId', value === '__none__' ? '' : value)
                    }>
                    <SelectTrigger
                      aria-label={t('sourceTransaction')}
                      className='h-11 w-full min-w-0'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>{t('selectTransaction')}</SelectItem>
                      {transactions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.description} · {item.amount} · {item.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {transactions.length === 0 && !searching && (
                  <p className='text-muted-foreground text-xs'>{t('searchHint')}</p>
                )}
                {field(t('principalAmount'), 'amount')}
                {field(t('evidenceReference'), 'evidenceReference', t('evidenceHint'))}
              </>
            )}
            <Button className='w-full sm:w-auto' type='button' onClick={review}>
              {t('reviewEntry')}
            </Button>
            {preview && (
              <div className='border-brand-secondary/25 bg-brand-secondary/5 space-y-4 rounded-xl border p-4'>
                <h3 className='font-medium'>{t('reviewBeforeSaving')}</h3>
                {preview.action === 'create_receivable' ? (
                  <p className='text-sm'>
                    {preview.borrower} · {preview.label} · {preview.currency}. {t('noPrincipal')}
                  </p>
                ) : (
                  <p className='text-sm'>
                    {preview.action === 'disbursement' ? t('lent') : t('repaid')}:{' '}
                    {selected
                      ? displayMoney(preview.amount_minor, selected, locale)
                      : preview.amount_minor}
                    . {t('remaining')}{' '}
                    {selected
                      ? displayMoney(
                          (
                            BigInt(selected.outstanding_minor) +
                            (preview.action === 'disbursement'
                              ? BigInt(preview.amount_minor)
                              : -BigInt(preview.amount_minor))
                          ).toString(),
                          selected,
                          locale,
                        )
                      : t('unknown')}
                    . {t('sourceTransaction')}: {preview.source_transaction_id}.
                  </p>
                )}
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    className='accent-success h-4 w-4 shrink-0'
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  {t('checked')}
                </label>
                <Button type='button' disabled={!checked || saving} onClick={() => void confirm()}>
                  {saving ? t('saving') : t('confirm')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
