'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { applyLoanEvent } from '@/lib/wealth/calculations';
import { formatDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
import { loanEventSchema, type LoanEventDraft } from '@/lib/wealth/manual-loans';

interface SavedLoan {
  id: string;
  lender: 'lulo_bank' | 'bancolombia';
  label: string;
  currency: string;
  money_scale: number;
  opening_recorded: boolean;
  outstanding_minor: string;
  interest_expense_minor: string;
  insurance_expense_minor: string;
  fee_expense_minor: string;
  manual_loan_events?: {
    id: string;
    kind: string;
    occurred_on: string;
    cash_paid_minor: string | null;
    principal_minor: string;
    interest_minor: string | null;
    insurance_minor: string | null;
    fee_minor: string | null;
  }[];
}

type Action = LoanEventDraft['action'];
interface Draft {
  action: Action;
  lender: SavedLoan['lender'];
  label: string;
  currency: string;
  moneyScale: string;
  loanId: string;
  date: string;
  outstanding: string;
  paid: string;
  principal: string;
  interest: string;
  insurance: string;
  fee: string;
  evidenceReference: string;
  evidenceDate: string;
}
const emptyDraft: Draft = {
  action: 'create_loan',
  lender: 'lulo_bank',
  label: '',
  currency: '',
  moneyScale: '',
  loanId: '',
  date: '',
  outstanding: '',
  paid: '',
  principal: '',
  interest: '',
  insurance: '',
  fee: '',
  evidenceReference: '',
  evidenceDate: '',
};

export default function LoansPage(): React.ReactElement {
  const [loans, setLoans] = useState<SavedLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [preview, setPreview] = useState<LoanEventDraft | null>(null);
  const [checked, setChecked] = useState(false);
  const requestId = useRef<string | null>(null);

  async function load(): Promise<void> {
    const response = await fetch('/api/loans');
    if (!response.ok) throw new Error('Could not load manual loans');
    const body = (await response.json()) as { data?: SavedLoan[] };
    setLoans(body.data ?? []);
  }
  useEffect(() => {
    void load()
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load loans'),
      )
      .finally(() => setLoading(false));
  }, []);
  function change<K extends keyof Draft>(field: K, value: Draft[K]): void {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setPreview(null);
    setChecked(false);
    requestId.current = null;
    setError(null);
  }
  const selected = loans.find((loan) => loan.id === draft.loanId);
  function build(): LoanEventDraft {
    const evidence = {
      kind: 'statement' as const,
      reference: draft.evidenceReference.trim(),
      observed_on: draft.evidenceDate,
    };
    if (draft.action === 'create_loan') {
      if (!/^[0-6]$/.test(draft.moneyScale))
        throw new Error('Enter the source currency decimal places');
      return loanEventSchema.parse({
        action: 'create_loan',
        lender: draft.lender,
        label: draft.label.trim(),
        currency: draft.currency.trim().toUpperCase(),
        money_scale: Number(draft.moneyScale),
        evidence,
      });
    }
    if (!selected) throw new Error('Select a loan');
    if (draft.action === 'opening') {
      if (selected.opening_recorded) throw new Error('Opening balance already recorded');
      return loanEventSchema.parse({
        action: 'opening',
        loan_id: selected.id,
        occurred_on: draft.date,
        outstanding_minor: parseDecimalUnits(draft.outstanding, selected.money_scale),
        evidence,
      });
    }
    if (!selected.opening_recorded) throw new Error('Record a sourced opening balance first');
    const event = loanEventSchema.parse({
      action: 'payment',
      loan_id: selected.id,
      occurred_on: draft.date,
      cash_paid_minor: parseDecimalUnits(draft.paid, selected.money_scale),
      principal_minor: parseDecimalUnits(draft.principal, selected.money_scale),
      interest_minor: parseDecimalUnits(draft.interest, selected.money_scale),
      insurance_minor: parseDecimalUnits(draft.insurance, selected.money_scale),
      fee_minor: parseDecimalUnits(draft.fee, selected.money_scale),
      evidence,
    });
    if (event.action === 'payment') {
      applyLoanEvent(
        {
          outstandingMinor: selected.outstanding_minor,
          interestExpenseMinor: selected.interest_expense_minor,
          insuranceExpenseMinor: selected.insurance_expense_minor,
          feeExpenseMinor: selected.fee_expense_minor,
        },
        {
          kind: 'payment',
          cashPaidMinor: event.cash_paid_minor,
          principalMinor: event.principal_minor,
          interestMinor: event.interest_minor,
          insuranceMinor: event.insurance_minor,
          feeMinor: event.fee_minor,
        },
      );
    }
    return event;
  }
  function review(): void {
    try {
      setPreview(build());
      setChecked(false);
      requestId.current = crypto.randomUUID();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check source details');
    }
  }
  async function confirm(): Promise<void> {
    if (!preview || !checked || !requestId.current) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/loans', {
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
      setPreview(null);
      setChecked(false);
      requestId.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save reviewed entry');
    } finally {
      setSaving(false);
    }
  }
  function money(value: string, loan: SavedLoan): string {
    return `${formatDecimalUnits(value, loan.money_scale)} ${loan.currency}`;
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
          <Landmark className='text-primary h-6 w-6' />
          <h1 className='text-2xl font-semibold'>Manual loan journal</h1>
        </div>
        <p className='text-muted-foreground text-sm'>
          Record sourced Lulo Bank and Bancolombia balances and payment allocations.
        </p>
        <p className='text-muted-foreground text-sm'>
          Loans you made to other people are tracked separately in{' '}
          <Link href='/receivables' className='underline'>
            Money owed to you
          </Link>
          .
        </p>
        <p className='border-border bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm'>
          This journal is separate from bank accounts, transactions, spending reports, and net
          worth. Entries here do not change those balances. Interest, insurance, and fees are never
          estimated.
        </p>
      </header>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]'>
        <section className='space-y-3' aria-label='Saved loans'>
          <h2 className='text-lg font-semibold'>Loans</h2>
          {loading ? (
            <p>Loading loans…</p>
          ) : loans.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                <p className='font-medium'>No loans yet</p>
                <p className='text-muted-foreground text-sm'>
                  Create a lender record, then enter a sourced opening balance. No balance or rate
                  is inferred.
                </p>
              </CardContent>
            </Card>
          ) : (
            loans.map((loan) => (
              <Card key={loan.id} className='gap-2'>
                <CardHeader>
                  <CardTitle className='text-base'>{loan.label}</CardTitle>
                  <p className='text-muted-foreground text-sm'>
                    {loan.lender === 'lulo_bank' ? 'Lulo Bank' : 'Bancolombia'} · {loan.currency}
                  </p>
                </CardHeader>
                <CardContent className='space-y-2 text-sm'>
                  <p>
                    Outstanding principal:{' '}
                    <strong>
                      {loan.opening_recorded ? money(loan.outstanding_minor, loan) : 'Not recorded'}
                    </strong>
                  </p>
                  <p className='text-muted-foreground'>
                    Rate: Not recorded. Payment expenses shown here are manual ledger values only.
                  </p>
                  {[...(loan.manual_loan_events ?? [])].reverse().map((event) => (
                    <p key={event.id} className='border-border border-t pt-2'>
                      {event.occurred_on} ·{' '}
                      {event.kind === 'opening'
                        ? `Opening principal ${money(event.principal_minor, loan)}`
                        : `Payment ${money(event.cash_paid_minor ?? '0', loan)} (principal ${money(event.principal_minor, loan)}, interest ${money(event.interest_minor ?? '0', loan)}, insurance ${money(event.insurance_minor ?? '0', loan)}, fees ${money(event.fee_minor ?? '0', loan)})`}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </section>
        <Card>
          <CardHeader>
            <CardTitle>New manual entry</CardTitle>
            <p className='text-muted-foreground text-sm'>
              Use exact figures from a statement or other evidence you reviewed.
            </p>
          </CardHeader>
          <CardContent className='space-y-4'>
            <label className='block space-y-1 text-sm font-medium'>
              Entry type
              <select
                className='border-input bg-background h-9 w-full rounded-md border px-3'
                value={draft.action}
                onChange={(event) => change('action', event.target.value as Action)}>
                <option value='create_loan'>Create loan</option>
                <option value='opening'>Opening balance</option>
                <option value='payment'>Payment allocation</option>
              </select>
            </label>
            {draft.action === 'create_loan' ? (
              <>
                <label className='block space-y-1 text-sm font-medium'>
                  Lender
                  <select
                    className='border-input bg-background h-9 w-full rounded-md border px-3'
                    value={draft.lender}
                    onChange={(event) => change('lender', event.target.value as Draft['lender'])}>
                    <option value='lulo_bank'>Lulo Bank</option>
                    <option value='bancolombia'>Bancolombia</option>
                  </select>
                </label>
                {field('Loan name', 'label')}
                {field('Currency', 'currency', 'COP')}
                {field('Money decimal places', 'moneyScale', '0 for COP')}
              </>
            ) : (
              <>
                <label className='block space-y-1 text-sm font-medium'>
                  Loan
                  <select
                    className='border-input bg-background h-9 w-full rounded-md border px-3'
                    value={draft.loanId}
                    onChange={(event) => change('loanId', event.target.value)}>
                    <option value=''>Select a loan</option>
                    {loans.map((loan) => (
                      <option key={loan.id} value={loan.id}>
                        {loan.label} · {loan.currency}
                      </option>
                    ))}
                  </select>
                </label>
                {field('Entry date', 'date', 'YYYY-MM-DD')}
                {draft.action === 'opening' ? (
                  field('Known outstanding principal', 'outstanding', 'Leave blank if unknown')
                ) : (
                  <>
                    {field('Cash paid', 'paid')}
                    {field('Principal paid', 'principal')}
                    {field('Interest paid', 'interest')}
                    {field('Insurance paid', 'insurance')}
                    {field('Fees paid', 'fee')}
                  </>
                )}
              </>
            )}
            {field('Evidence reference', 'evidenceReference', 'Statement and page or entry')}
            {field('Evidence date', 'evidenceDate', 'YYYY-MM-DD')}
            <Button type='button' onClick={review}>
              Review entry
            </Button>
            {preview && (
              <div className='border-border bg-muted/30 space-y-3 rounded-lg border p-4'>
                <h3 className='font-medium'>Review before saving</h3>
                <p className='text-muted-foreground text-sm'>
                  {preview.action === 'create_loan'
                    ? `${preview.lender} · ${preview.label} · ${preview.currency}. No opening balance recorded.`
                    : preview.action === 'opening'
                      ? `Opening principal: ${selected ? money(preview.outstanding_minor, selected) : preview.outstanding_minor}`
                      : `Cash paid ${selected ? money(preview.cash_paid_minor, selected) : preview.cash_paid_minor}; principal ${selected ? money(preview.principal_minor, selected) : preview.principal_minor}; interest ${selected ? money(preview.interest_minor, selected) : preview.interest_minor}; insurance ${selected ? money(preview.insurance_minor, selected) : preview.insurance_minor}; fees ${selected ? money(preview.fee_minor, selected) : preview.fee_minor}.`}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Evidence: {preview.evidence.reference} · {preview.evidence.observed_on}
                </p>
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={checked}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  I checked these details against the evidence
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
