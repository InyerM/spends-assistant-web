'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WealthRecordControls } from '@/components/wealth/wealth-record-controls';
import { WealthEventLink } from '@/components/wealth/wealth-event-link';
import { applyLoanEvent } from '@/lib/wealth/calculations';
import { formatLocalizedDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
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
  archived_at?: string | null;
  manual_loan_events?: {
    id: string;
    kind: string;
    occurred_on: string;
    cash_paid_minor: string | null;
    principal_minor: string;
    interest_minor: string | null;
    insurance_minor: string | null;
    fee_minor: string | null;
    source_transaction_id?: string | null;
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
  const t = useTranslations('wealth.loans');
  const locale = useLocale();
  const loadError = t('loadFailed');
  const [loans, setLoans] = useState<SavedLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [preview, setPreview] = useState<LoanEventDraft | null>(null);
  const [checked, setChecked] = useState(false);
  const [historyView, setHistoryView] = useState(false);
  const requestId = useRef<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/loans');
    if (!response.ok) throw new Error(loadError);
    const body = (await response.json()) as { data?: SavedLoan[] };
    setLoans(body.data ?? []);
  }, [loadError]);
  useEffect(() => {
    void load()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : loadError))
      .finally(() => setLoading(false));
  }, [load, loadError]);
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
      if (!/^[0-6]$/.test(draft.moneyScale)) throw new Error(t('scaleRequired'));
      return loanEventSchema.parse({
        action: 'create_loan',
        lender: draft.lender,
        label: draft.label.trim(),
        currency: draft.currency.trim().toUpperCase(),
        money_scale: Number(draft.moneyScale),
        evidence,
      });
    }
    if (!selected) throw new Error(t('selectLoanError'));
    if (draft.action === 'opening') {
      if (selected.opening_recorded) throw new Error(t('openingAlready'));
      return loanEventSchema.parse({
        action: 'opening',
        loan_id: selected.id,
        occurred_on: draft.date,
        outstanding_minor: parseDecimalUnits(draft.outstanding, selected.money_scale),
        evidence,
      });
    }
    if (!selected.opening_recorded) throw new Error(t('openingRequired'));
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
      setError(cause instanceof Error ? cause.message : t('checkSource'));
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
        throw new Error(body.error ?? t('saveFailed'));
      }
      await load();
      setDraft(emptyDraft);
      setPreview(null);
      setChecked(false);
      requestId.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }
  function money(value: string, loan: SavedLoan): string {
    return `${formatLocalizedDecimalUnits(value, loan.money_scale, locale)} ${loan.currency}`;
  }
  const currentLoans = loans.filter(
    (loan) => !loan.archived_at && (!loan.opening_recorded || loan.outstanding_minor !== '0'),
  );
  const historicalLoans = loans.filter(
    (loan) => !!loan.archived_at || (loan.opening_recorded && loan.outstanding_minor === '0'),
  );
  const visibleLoans = historyView ? historicalLoans : currentLoans;
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
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        </div>
        <p className='text-muted-foreground text-sm'>{t('subtitle')}</p>
        <p className='text-muted-foreground text-sm'>
          {t('receivableNote')}{' '}
          <Link href='/receivables' className='underline'>
            {t('receivableLink')}
          </Link>
          .
        </p>
        <p className='border-border bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm'>
          {t('journalNote')}
        </p>
      </header>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]'>
        <section className='space-y-3' aria-label={t('section')}>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-lg font-semibold'>{t('section')}</h2>
            <div className='bg-muted flex rounded-lg p-1 text-sm'>
              <Button
                size='sm'
                variant={!historyView ? 'secondary' : 'ghost'}
                onClick={() => setHistoryView(false)}>
                {t('current')} ({currentLoans.length})
              </Button>
              <Button
                size='sm'
                variant={historyView ? 'secondary' : 'ghost'}
                onClick={() => setHistoryView(true)}>
                {t('history')} ({historicalLoans.length})
              </Button>
            </div>
          </div>
          {loading ? (
            <p>{t('loading')}</p>
          ) : visibleLoans.length === 0 ? (
            <Card>
              <CardContent className='pt-6'>
                <p className='font-medium'>
                  {loans.length === 0 ? t('empty') : historyView ? t('noHistory') : t('noCurrent')}
                </p>
                <p className='text-muted-foreground text-sm'>
                  {loans.length === 0 ? t('emptyHint') : null}
                </p>
              </CardContent>
            </Card>
          ) : (
            visibleLoans.map((loan) => (
              <Card key={loan.id} className='gap-2'>
                <CardHeader>
                  <CardTitle className='text-base'>{loan.label}</CardTitle>
                  <p className='text-muted-foreground text-sm'>
                    {loan.lender === 'lulo_bank' ? 'Lulo Bank' : 'Bancolombia'} · {loan.currency}
                  </p>
                  {(loan.archived_at ||
                    (loan.opening_recorded && loan.outstanding_minor === '0')) && (
                    <span className='text-muted-foreground text-xs'>
                      {loan.archived_at ? t('archived') : t('paidOff')}
                    </span>
                  )}
                </CardHeader>
                <CardContent className='space-y-2 text-sm'>
                  <p>
                    {t('outstanding')}{' '}
                    <strong>
                      {loan.opening_recorded
                        ? money(loan.outstanding_minor, loan)
                        : t('notRecorded')}
                    </strong>
                  </p>
                  <p className='text-muted-foreground'>{t('rateHint')}</p>
                  {(loan.manual_loan_events?.length ?? 0) > 0 && (
                    <details className='border-border border-t pt-2'>
                      <summary className='cursor-pointer font-medium'>
                        {t('recordedEvents', { count: loan.manual_loan_events?.length ?? 0 })}
                      </summary>
                      <div className='mt-2 space-y-2'>
                        {[...(loan.manual_loan_events ?? [])]
                          .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
                          .map((event) => (
                            <div key={event.id} className='border-border space-y-1 border-t pt-2'>
                              <p>
                                {event.occurred_on} ·{' '}
                                {event.kind === 'opening'
                                  ? t('openingPrincipal', {
                                      amount: money(event.principal_minor, loan),
                                    })
                                  : t('paymentSummary', {
                                      paid: money(event.cash_paid_minor ?? '0', loan),
                                      principal: money(event.principal_minor, loan),
                                      interest: money(event.interest_minor ?? '0', loan),
                                      insurance: money(event.insurance_minor ?? '0', loan),
                                      fees: money(event.fee_minor ?? '0', loan),
                                    })}
                              </p>
                              <WealthEventLink
                                kind='loan_event'
                                eventType={event.kind === 'opening' ? 'opening' : 'payment'}
                                eventId={event.id}
                                date={event.occurred_on}
                                transactionId={event.source_transaction_id ?? null}
                                onChanged={load}
                              />
                            </div>
                          ))}
                      </div>
                    </details>
                  )}
                  <WealthRecordControls
                    kind='loan'
                    id={loan.id}
                    name={loan.label}
                    hasEvents={(loan.manual_loan_events?.length ?? 0) > 0}
                    archived={!!loan.archived_at}
                    onChanged={load}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </section>
        <Card>
          <CardHeader>
            <CardTitle>{t('newEntry')}</CardTitle>
            <p className='text-muted-foreground text-sm'>{t('entryHint')}</p>
          </CardHeader>
          <CardContent className='space-y-4'>
            <label className='block space-y-1 text-sm font-medium'>
              {t('entryType')}
              <select
                className='border-input bg-background h-9 w-full rounded-md border px-3'
                value={draft.action}
                onChange={(event) => change('action', event.target.value as Action)}>
                <option value='create_loan'>{t('createLoan')}</option>
                <option value='opening'>{t('openingBalance')}</option>
                <option value='payment'>{t('paymentAllocation')}</option>
              </select>
            </label>
            {draft.action === 'create_loan' ? (
              <>
                <label className='block space-y-1 text-sm font-medium'>
                  {t('lender')}
                  <select
                    className='border-input bg-background h-9 w-full rounded-md border px-3'
                    value={draft.lender}
                    onChange={(event) => change('lender', event.target.value as Draft['lender'])}>
                    <option value='lulo_bank'>Lulo Bank</option>
                    <option value='bancolombia'>Bancolombia</option>
                  </select>
                </label>
                {field(t('loanName'), 'label')}
                {field(t('currency'), 'currency', 'COP')}
                {field(t('moneyPlaces'), 'moneyScale', t('forCop'))}
              </>
            ) : (
              <>
                <label className='block space-y-1 text-sm font-medium'>
                  {t('loan')}
                  <select
                    className='border-input bg-background h-9 w-full rounded-md border px-3'
                    value={draft.loanId}
                    onChange={(event) => change('loanId', event.target.value)}>
                    <option value=''>{t('selectLoan')}</option>
                    {loans.map((loan) => (
                      <option key={loan.id} value={loan.id}>
                        {loan.label} · {loan.currency}
                      </option>
                    ))}
                  </select>
                </label>
                {field(t('entryDate'), 'date', 'YYYY-MM-DD')}
                {draft.action === 'opening' ? (
                  field(t('knownOutstanding'), 'outstanding', t('unknownHint'))
                ) : (
                  <>
                    {field(t('cashPaid'), 'paid')}
                    {field(t('principalPaid'), 'principal')}
                    {field(t('interestPaid'), 'interest')}
                    {field(t('insurancePaid'), 'insurance')}
                    {field(t('feesPaid'), 'fee')}
                  </>
                )}
              </>
            )}
            {field(t('evidenceReference'), 'evidenceReference', t('evidenceHint'))}
            {field(t('evidenceDate'), 'evidenceDate', 'YYYY-MM-DD')}
            <Button type='button' onClick={review}>
              {t('reviewEntry')}
            </Button>
            {preview && (
              <div className='border-border bg-muted/30 space-y-3 rounded-lg border p-4'>
                <h3 className='font-medium'>{t('reviewBeforeSaving')}</h3>
                <p className='text-muted-foreground text-sm'>
                  {preview.action === 'create_loan'
                    ? `${preview.lender} · ${preview.label} · ${preview.currency}. ${t('noOpening')}`
                    : preview.action === 'opening'
                      ? t('openingPreview', {
                          amount: selected
                            ? money(preview.outstanding_minor, selected)
                            : preview.outstanding_minor,
                        })
                      : t('paymentPreview', {
                          paid: selected
                            ? money(preview.cash_paid_minor, selected)
                            : preview.cash_paid_minor,
                          principal: selected
                            ? money(preview.principal_minor, selected)
                            : preview.principal_minor,
                          interest: selected
                            ? money(preview.interest_minor, selected)
                            : preview.interest_minor,
                          insurance: selected
                            ? money(preview.insurance_minor, selected)
                            : preview.insurance_minor,
                          fees: selected ? money(preview.fee_minor, selected) : preview.fee_minor,
                        })}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {t('evidence')} {preview.evidence.reference} · {preview.evidence.observed_on}
                </p>
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
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
