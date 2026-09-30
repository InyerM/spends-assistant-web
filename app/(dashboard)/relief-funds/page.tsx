'use client';

import { useEffect, useRef, useState } from 'react';
import { HeartHandshake, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
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

function amountLabel(value: string): string {
  const negative = value.startsWith('-');
  const units = negative ? value.slice(1) : value;
  return `${negative ? '-' : ''}${formatDecimalUnits(units, 2)} COP`;
}

export default function ReliefFundsPage(): React.ReactElement {
  const [funds, setFunds] = useState<SavedFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [reviewEvent, setReviewEvent] = useState<ReliefFundEvent | null>(null);
  const [checked, setChecked] = useState(false);
  const requestId = useRef<string | null>(null);

  async function loadFunds(): Promise<void> {
    const response = await fetch('/api/relief-funds');
    if (!response.ok) throw new Error('Could not load relief funds');
    const body = (await response.json()) as { data?: SavedFund[] };
    setFunds(body.data ?? []);
  }

  useEffect(() => {
    void loadFunds()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load relief funds');
      })
      .finally(() => setLoading(false));
  }, []);

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
      setError('Check the date, exact amount, source, and description');
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
        throw new Error(body.error ?? 'Could not save reviewed entry');
      }
      await loadFunds();
      setDraft(emptyDraft);
      setReviewEvent(null);
      setChecked(false);
      requestId.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save reviewed entry');
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
            <h1 className='text-2xl font-semibold tracking-tight'>Relief funds</h1>
            <p className='text-muted-foreground text-sm'>
              Track money earmarked for emergency purchases and what you can verify was spent.
            </p>
          </div>
        </div>
        <p className='border-border bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm'>
          This reviewed journal does not create transactions or change bank balances. A linked
          transaction is a reference to an existing ledger movement, not a second expense.
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
        <section aria-label='Saved relief funds' className='space-y-3'>
          <h2 className='text-lg font-semibold'>Saved funds</h2>
          {loading ? (
            <p className='text-muted-foreground text-sm'>Loading funds…</p>
          ) : funds.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                <p className='font-medium'>No relief funds yet</p>
                <p className='text-muted-foreground text-sm'>
                  Create a fund, then add only reviewed receipts and purchases.
                </p>
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
                        <span className='text-muted-foreground block text-xs'>Received</span>
                        {amountLabel(summary.receiptsMinor)}
                      </p>
                      <p>
                        <span className='text-muted-foreground block text-xs'>Known outlays</span>
                        {amountLabel(summary.outlaysMinor)}
                      </p>
                      <p>
                        <span className='text-muted-foreground block text-xs'>
                          Known receipts minus known outlays
                        </span>
                        {amountLabel(summary.knownRemainderMinor)}
                      </p>
                    </div>
                    {!summary.actualRemainderKnown && (
                      <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm'>
                        Actual remainder unknown: {summary.unknownSpendCount} unquantified spending
                        note{summary.unknownSpendCount === 1 ? '' : 's'}.
                      </p>
                    )}
                    <ul className='divide-border divide-y text-sm'>
                      {entries.map((entry) => (
                        <li key={entry.id} className='flex flex-wrap justify-between gap-x-3 py-2'>
                          <span>
                            <span className='text-muted-foreground mr-2'>
                              {entry.occurred_on ?? 'Date unknown'}
                            </span>
                            {entry.description}
                            <span className='text-muted-foreground block text-xs'>
                              {entry.source_kind.replaceAll('_', ' ')} · {entry.source_reference}
                            </span>
                          </span>
                          <span className='font-mono tabular-nums'>
                            {entry.amount_minor === null
                              ? 'Amount unknown'
                              : `${entry.kind === 'outlay' ? '-' : '+'}${amountLabel(entry.amount_minor)}`}
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

        <section aria-label='New relief fund entry'>
          <Card>
            <CardHeader>
              <CardTitle>New reviewed entry</CardTitle>
              <CardDescription>
                Use the exact source amount when known. Leave unknown spending unquantified.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <label className='block space-y-1 text-sm'>
                Entry type
                <select
                  aria-label='Entry type'
                  className='border-input bg-background w-full rounded-md border p-2'
                  value={draft.entryType}
                  onChange={(event) => changeType(event.target.value as EntryType)}>
                  <option value='create_fund'>Create fund</option>
                  <option value='receipt'>Donation received</option>
                  <option value='outlay'>Known purchase</option>
                  <option value='unknown_spend'>Spend, amount unknown</option>
                </select>
              </label>
              {draft.entryType === 'create_fund' ? (
                <>
                  <label className='block space-y-1 text-sm'>
                    Fund title
                    <Input
                      aria-label='Fund title'
                      value={draft.title}
                      onChange={(event) => change('title', event.target.value)}
                    />
                  </label>
                  <label className='block space-y-1 text-sm'>
                    Purpose
                    <Input
                      aria-label='Purpose'
                      value={draft.purpose}
                      onChange={(event) => change('purpose', event.target.value)}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className='block space-y-1 text-sm'>
                    Fund
                    <select
                      aria-label='Fund'
                      className='border-input bg-background w-full rounded-md border p-2'
                      value={draft.fundId}
                      onChange={(event) => change('fundId', event.target.value)}>
                      <option value=''>Select fund</option>
                      {funds.map((fund) => (
                        <option key={fund.id} value={fund.id}>
                          {fund.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className='block space-y-1 text-sm'>
                    {draft.entryType === 'unknown_spend' ? 'Date (optional)' : 'Date'}
                    <Input
                      aria-label={draft.entryType === 'unknown_spend' ? 'Date (optional)' : 'Date'}
                      type='date'
                      value={draft.date}
                      onChange={(event) => change('date', event.target.value)}
                    />
                  </label>
                  {draft.entryType !== 'unknown_spend' && (
                    <label className='block space-y-1 text-sm'>
                      Exact amount (COP)
                      <Input
                        aria-label='Exact amount (COP)'
                        inputMode='decimal'
                        value={draft.amount}
                        onChange={(event) => change('amount', event.target.value)}
                      />
                    </label>
                  )}
                  <label className='block space-y-1 text-sm'>
                    Description
                    <Input
                      aria-label='Description'
                      value={draft.description}
                      onChange={(event) => change('description', event.target.value)}
                    />
                  </label>
                  <label className='block space-y-1 text-sm'>
                    Source type
                    <select
                      aria-label='Source type'
                      className='border-input bg-background w-full rounded-md border p-2'
                      value={draft.sourceKind}
                      onChange={(event) => {
                        change('sourceKind', event.target.value as SourceKind);
                        change('transactionId', '');
                      }}>
                      <option value='bank_notice'>Bank notice</option>
                      <option value='cash'>Cash</option>
                      <option value='receipt'>Receipt</option>
                      <option value='manual_recollection'>Manual recollection</option>
                      {draft.entryType !== 'unknown_spend' && (
                        <option value='ledger_transaction'>Existing ledger transaction</option>
                      )}
                    </select>
                  </label>
                  <label className='block space-y-1 text-sm'>
                    Source reference
                    <Input
                      aria-label='Source reference'
                      value={draft.sourceReference}
                      onChange={(event) => change('sourceReference', event.target.value)}
                    />
                  </label>
                  {draft.sourceKind === 'ledger_transaction' && (
                    <label className='block space-y-1 text-sm'>
                      Transaction ID
                      <Input
                        aria-label='Transaction ID'
                        value={draft.transactionId}
                        onChange={(event) => change('transactionId', event.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
              <Button onClick={review} disabled={saving}>
                Review entry
              </Button>
              {reviewEvent && (
                <div className='border-border space-y-3 rounded-lg border p-3 text-sm'>
                  <p className='font-medium'>Review before saving</p>
                  <p>
                    {reviewEvent.action === 'create_fund'
                      ? `${reviewEvent.title} · ${reviewEvent.purpose}`
                      : `${reviewEvent.occurred_on ?? 'Date unknown'} · ${reviewEvent.description} · ${reviewEvent.amount_minor === null ? 'amount unknown' : amountLabel(reviewEvent.amount_minor)}`}
                  </p>
                  <label className='flex items-center gap-2'>
                    <input
                      type='checkbox'
                      checked={checked}
                      onChange={(event) => setChecked(event.target.checked)}
                      aria-label='I checked this against the source'
                    />
                    I checked this against the source
                  </label>
                  <Button onClick={() => void confirm()} disabled={!checked || saving}>
                    Confirm reviewed entry
                  </Button>
                </div>
              )}
              <p className='text-muted-foreground flex items-start gap-2 text-xs'>
                <CircleAlert className='mt-0.5 h-3.5 w-3.5 shrink-0' />A recalled amount is not a
                confirmed outlay. Save an unknown-spending note until you have evidence.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
