'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
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

function displayMoney(amount: string, receivable: SavedReceivable): string {
  return `${formatDecimalUnits(amount, receivable.money_scale)} ${receivable.currency}`;
}

export default function ReceivablesPage(): React.ReactElement {
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

  async function load(): Promise<void> {
    const response = await fetch('/api/receivables');
    if (!response.ok) throw new Error('Could not load personal receivables');
    const body = (await response.json()) as { data?: SavedReceivable[] };
    setReceivables(body.data ?? []);
  }

  useEffect(() => {
    void load()
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load personal receivables'),
      )
      .finally(() => setLoading(false));
  }, []);

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
      setError('Enter an event date first');
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
      if (!response.ok) throw new Error('Could not find transactions');
      const body = (await response.json()) as { data?: SourceTransaction[] };
      setTransactions(body.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not find transactions');
    } finally {
      setSearching(false);
    }
  }

  function build(): ReceivableEventDraft {
    if (draft.action === 'create_receivable') {
      if (!/^[0-2]$/.test(draft.moneyScale))
        throw new Error('Enter decimal places from the source');
      return receivableEventSchema.parse({
        action: draft.action,
        borrower: draft.borrower,
        label: draft.label,
        currency: draft.currency.trim().toUpperCase(),
        money_scale: Number(draft.moneyScale),
      });
    }
    if (!selected) throw new Error('Select a receivable');
    const transaction = transactions.find((item) => item.id === draft.sourceTransactionId);
    if (!transaction) throw new Error('Select an existing bank transaction');
    const amountMinor = parseDecimalUnits(draft.amount, selected.money_scale);
    if (amountMinor !== parseDecimalUnits(String(transaction.amount), selected.money_scale))
      throw new Error('Principal amount must equal the selected bank transaction');
    if (
      transaction.date !== draft.date ||
      transaction.type !== (draft.action === 'disbursement' ? 'expense' : 'income')
    )
      throw new Error('Selected transaction date or direction does not match');
    if (draft.action === 'repayment' && BigInt(amountMinor) > BigInt(selected.outstanding_minor))
      throw new Error('Repayment exceeds outstanding principal');
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
      setError(cause instanceof Error ? cause.message : 'Check the source details');
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
        throw new Error(body.error ?? 'Could not save reviewed entry');
      }
      await load();
      setDraft(emptyDraft);
      setTransactions([]);
      setPreview(null);
      setChecked(false);
      requestId.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save reviewed entry');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof Draft, placeholder = ''): React.ReactElement => (
    <label className='block space-y-1 text-sm font-medium' key={key}>
      {label}
      <Input
        value={draft[key]}
        onChange={(event) => change(key, event.target.value as never)}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <main className='mx-auto max-w-6xl space-y-6 p-4 sm:p-6'>
      <header className='space-y-2'>
        <div className='flex items-center gap-3'>
          <HandCoins className='text-primary h-6 w-6' />
          <h1 className='text-2xl font-semibold'>Money owed to you</h1>
        </div>
        <p className='text-muted-foreground text-sm'>
          Track principal you lent to other people and reviewed repayments.
        </p>
        <p className='border-border bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm'>
          This is a separate receivables journal. It links existing bank transactions and never
          moves account balances or adds amounts to spending or net worth totals. Only principal
          repayments reduce a loan. Sales, gifts, and unrelated transfers stay separate. Your own
          bank debts are tracked in{' '}
          <Link href='/loans' className='underline'>
            Loans you owe
          </Link>
          .
        </p>
      </header>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]'>
        <section className='space-y-3' aria-label='Saved receivables'>
          <h2 className='text-lg font-semibold'>Receivables</h2>
          {loading ? (
            <p>Loading receivables…</p>
          ) : receivables.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                No receivables yet. Create a borrower record first.
              </CardContent>
            </Card>
          ) : (
            receivables.map((item) => (
              <Card key={item.id} className='gap-2'>
                <CardHeader>
                  <CardTitle className='text-base'>{item.label}</CardTitle>
                  <p className='text-muted-foreground text-sm'>
                    {item.borrower} · {item.currency}
                  </p>
                </CardHeader>
                <CardContent className='space-y-2 text-sm'>
                  <p>
                    Outstanding principal:{' '}
                    <strong>{displayMoney(item.outstanding_minor, item)}</strong>
                  </p>
                  {(item.personal_receivable_events ?? []).map((event) => (
                    <p key={event.id} className='border-border border-t pt-2'>
                      {event.occurred_on} ·{' '}
                      {event.kind === 'disbursement' ? 'Lent' : 'Principal repaid'}{' '}
                      {displayMoney(event.amount_minor, item)} · transaction{' '}
                      {event.source_transaction_id.slice(0, 8)}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </section>
        <Card>
          <CardHeader>
            <CardTitle>New reviewed entry</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <label className='block space-y-1 text-sm font-medium'>
              Entry type
              <select
                className='border-input bg-background h-9 w-full rounded-md border px-3'
                value={draft.action}
                onChange={(event) => change('action', event.target.value as Action)}>
                <option value='create_receivable'>Create borrower record</option>
                <option value='disbursement'>Money lent</option>
                <option value='repayment'>Principal repayment</option>
              </select>
            </label>
            {draft.action === 'create_receivable' ? (
              <>
                {field('Borrower', 'borrower')}
                {field('Loan label', 'label')}
                {field('Currency', 'currency', 'COP')}
                {field('Decimal places', 'moneyScale', '0 for COP')}
              </>
            ) : (
              <>
                <label className='block space-y-1 text-sm font-medium'>
                  Receivable
                  <select
                    className='border-input bg-background h-9 w-full rounded-md border px-3'
                    value={draft.receivableId}
                    onChange={(event) => change('receivableId', event.target.value)}>
                    <option value=''>Select a receivable</option>
                    {receivables.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} · {item.borrower}
                      </option>
                    ))}
                  </select>
                </label>
                {field('Event date', 'date', 'YYYY-MM-DD')}
                <Button
                  type='button'
                  variant='outline'
                  disabled={searching}
                  onClick={() => void findTransactions()}>
                  {searching ? 'Searching…' : 'Find bank transaction'}
                </Button>
                <label className='block space-y-1 text-sm font-medium'>
                  Source transaction
                  <select
                    className='border-input bg-background h-9 w-full rounded-md border px-3'
                    value={draft.sourceTransactionId}
                    onChange={(event) => change('sourceTransactionId', event.target.value)}>
                    <option value=''>Select a transaction</option>
                    {transactions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.description} · {item.amount} · {item.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                {transactions.length === 0 && !searching && (
                  <p className='text-muted-foreground text-xs'>
                    Search the event date. The received transaction must be recorded as income
                    before linking a repayment.
                  </p>
                )}
                {field('Principal amount', 'amount')}
                {field(
                  'Evidence reference',
                  'evidenceReference',
                  'Why this transaction is principal',
                )}
              </>
            )}
            <Button type='button' onClick={review}>
              Review entry
            </Button>
            {preview && (
              <div className='border-border bg-muted/30 space-y-3 rounded-lg border p-4'>
                <h3 className='font-medium'>Review before saving</h3>
                {preview.action === 'create_receivable' ? (
                  <p className='text-sm'>
                    {preview.borrower} · {preview.label} · {preview.currency}. No principal recorded
                    yet.
                  </p>
                ) : (
                  <p className='text-sm'>
                    {preview.action === 'disbursement' ? 'Lent' : 'Principal repaid'}:{' '}
                    {selected ? displayMoney(preview.amount_minor, selected) : preview.amount_minor}
                    . Remaining principal:{' '}
                    {selected
                      ? displayMoney(
                          (
                            BigInt(selected.outstanding_minor) +
                            (preview.action === 'disbursement'
                              ? BigInt(preview.amount_minor)
                              : -BigInt(preview.amount_minor))
                          ).toString(),
                          selected,
                        )
                      : 'Unknown'}
                    . Source transaction: {preview.source_transaction_id}.
                  </p>
                )}
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  I checked this against the transaction and evidence
                </label>
                <Button type='button' disabled={!checked || saving} onClick={() => void confirm()}>
                  {saving ? 'Saving…' : 'Confirm reviewed entry'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
