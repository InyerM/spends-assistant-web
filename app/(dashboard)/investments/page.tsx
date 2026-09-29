'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpenCheck, CircleAlert, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { applyPositionTrade, valuePosition } from '@/lib/wealth/calculations';
import { formatDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
import { investmentEventSchema, type InvestmentEventDraft } from '@/lib/wealth/manual-entry';

interface SavedPosition {
  id: string;
  provider: 'tyba' | 'binance';
  symbol: string;
  quote_currency: string;
  quantity_scale: number;
  money_scale: number;
  quantity_atoms: string;
  cost_basis_minor: string;
  realized_return_minor: string;
  investment_trades?: { id: string; occurred_on: string }[];
  investment_valuations?: {
    id: string;
    as_of: string;
    market_value_minor: string;
    created_at: string;
  }[];
}

type Action = InvestmentEventDraft['action'];

interface Draft {
  action: Action;
  provider: 'tyba' | 'binance';
  symbol: string;
  quoteUnit: string;
  quantityScale: string;
  moneyScale: string;
  positionId: string;
  date: string;
  quantity: string;
  gross: string;
  knownZeroBasis: boolean;
  fee: string;
  evidenceReference: string;
  evidenceDate: string;
}

const emptyDraft: Draft = {
  action: 'create_position',
  provider: 'tyba',
  symbol: '',
  quoteUnit: '',
  quantityScale: '',
  moneyScale: '',
  positionId: '',
  date: '',
  quantity: '',
  gross: '',
  knownZeroBasis: false,
  fee: '',
  evidenceReference: '',
  evidenceDate: '',
};

function signedAmount(value: string, scale: number): string {
  return value.startsWith('-')
    ? `-${formatDecimalUnits(value.slice(1), scale)}`
    : formatDecimalUnits(value, scale);
}

function latestValuation(
  position: SavedPosition,
): NonNullable<SavedPosition['investment_valuations']>[number] | null {
  return (
    [...(position.investment_valuations ?? [])].sort(
      (a, b) => b.as_of.localeCompare(a.as_of) || b.created_at.localeCompare(a.created_at),
    )[0] ?? null
  );
}

export default function InvestmentsPage(): React.ReactElement {
  const [positions, setPositions] = useState<SavedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [reviewEvent, setReviewEvent] = useState<InvestmentEventDraft | null>(null);
  const [checked, setChecked] = useState(false);
  const requestId = useRef<string | null>(null);

  async function loadPositions(): Promise<void> {
    const response = await fetch('/api/investments');
    if (!response.ok) throw new Error('Could not load manual positions');
    const body = (await response.json()) as { data?: SavedPosition[] };
    setPositions(body.data ?? []);
  }

  useEffect(() => {
    void loadPositions()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load manual positions');
      })
      .finally(() => setLoading(false));
  }, []);

  function change<K extends keyof Draft>(field: K, value: Draft[K]): void {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setReviewEvent(null);
    setChecked(false);
    requestId.current = null;
    setError(null);
  }

  function buildEvent(): InvestmentEventDraft {
    const evidence = {
      kind: 'manual_review' as const,
      reference: draft.evidenceReference.trim(),
      observed_on: draft.evidenceDate,
    };
    if (draft.action === 'create_position') {
      if (
        !/^(0|[1-9]|1[0-8])$/.test(draft.quantityScale) ||
        !/^(0|[1-9]|1[0-8])$/.test(draft.moneyScale)
      ) {
        throw new Error('Enter both decimal-place values from the source');
      }
      return investmentEventSchema.parse({
        action: 'create_position',
        provider: draft.provider,
        symbol: draft.symbol.trim(),
        quote_currency: draft.quoteUnit.trim().toUpperCase(),
        quantity_scale: Number(draft.quantityScale),
        money_scale: Number(draft.moneyScale),
        evidence,
      });
    }
    const position = positions.find((item) => item.id === draft.positionId);
    if (!position) throw new Error('Select a position first');
    if (draft.action === 'valuation') {
      return investmentEventSchema.parse({
        action: 'valuation',
        position_id: position.id,
        as_of: draft.date,
        market_value_minor: parseDecimalUnits(draft.gross, position.money_scale),
        evidence,
      });
    }
    const latestTradeDate = position.investment_trades?.reduce(
      (latest, trade) => (trade.occurred_on > latest ? trade.occurred_on : latest),
      '',
    );
    if (latestTradeDate && draft.date < latestTradeDate) {
      throw new Error(
        `Enter trades in chronological order. Latest recorded trade date: ${latestTradeDate}`,
      );
    }
    const quantityAtoms = parseDecimalUnits(draft.quantity, position.quantity_scale);
    if (draft.action === 'opening') {
      const costBasisMinor = parseDecimalUnits(draft.gross, position.money_scale);
      return investmentEventSchema.parse({
        action: 'opening',
        position_id: position.id,
        occurred_on: draft.date,
        quantity_atoms: quantityAtoms,
        cost_basis_minor: costBasisMinor,
        known_zero_basis: costBasisMinor === '0' ? draft.knownZeroBasis : undefined,
        evidence,
      });
    }
    const event = investmentEventSchema.parse({
      action: draft.action,
      position_id: position.id,
      occurred_on: draft.date,
      quantity_atoms: quantityAtoms,
      gross_minor: parseDecimalUnits(draft.gross, position.money_scale),
      fee_minor: parseDecimalUnits(draft.fee || '0', position.money_scale),
      evidence,
    });
    if (event.action === 'sell') {
      applyPositionTrade(
        {
          quantityAtoms: position.quantity_atoms,
          costBasisMinor: position.cost_basis_minor,
          realizedReturnMinor: position.realized_return_minor,
        },
        {
          kind: 'sell',
          quantityAtoms: event.quantity_atoms,
          grossMinor: event.gross_minor,
          feeMinor: event.fee_minor,
        },
      );
    }
    return event;
  }

  function review(): void {
    try {
      setReviewEvent(buildEvent());
      setChecked(false);
      requestId.current = crypto.randomUUID();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check the entry details');
    }
  }

  async function confirm(): Promise<void> {
    if (!reviewEvent || !checked || !requestId.current) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId.current, reviewed: true, event: reviewEvent }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? 'Could not save reviewed entry');
      }
      await loadPositions();
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

  const selected = positions.find((item) => item.id === draft.positionId);
  const isTrade = draft.action === 'opening' || draft.action === 'buy' || draft.action === 'sell';
  const needsPosition = draft.action !== 'create_position';

  return (
    <main className='mx-auto max-w-6xl space-y-6 p-4 sm:p-6'>
      <header className='space-y-2'>
        <div className='flex items-center gap-3'>
          <div className='bg-primary/10 text-primary rounded-xl p-2.5'>
            <TrendingUp className='h-5 w-5' />
          </div>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>Manual investment journal</h1>
            <p className='text-muted-foreground text-sm'>
              Record reviewed Tyba and Binance positions, trades, and dated values.
            </p>
          </div>
        </div>
        <p className='border-border bg-muted/40 text-muted-foreground rounded-lg border px-4 py-3 text-sm'>
          This journal is separate from bank accounts, transactions, spending reports, and net
          worth. Entries here do not change those balances. No prices are fetched automatically.
        </p>
      </header>

      {error && (
        <div
          role='alert'
          className='border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm'>
          <CircleAlert className='h-4 w-4' />
          {error}
        </div>
      )}

      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]'>
        <section className='space-y-3' aria-label='Saved positions'>
          <div className='flex items-end justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>Positions</h2>
              <p className='text-muted-foreground text-sm'>
                Only entries you reviewed appear here.
              </p>
            </div>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {positions.length} saved
            </span>
          </div>
          {loading ? (
            <p className='text-muted-foreground text-sm'>Loading positions…</p>
          ) : positions.length === 0 ? (
            <Card>
              <CardContent className='space-y-2 pt-6'>
                <BookOpenCheck className='text-muted-foreground h-6 w-6' />
                <p className='font-medium'>No positions yet</p>
                <p className='text-muted-foreground text-sm'>
                  Create a position, then add a reviewed opening lot or trade. Nothing is inferred
                  from bank balances.
                </p>
              </CardContent>
            </Card>
          ) : (
            positions.map((position) => {
              const valuation = latestValuation(position);
              const hasTrade = (position.investment_trades?.length ?? 0) > 0;
              const valued =
                valuation && hasTrade
                  ? valuePosition(
                      {
                        quantityAtoms: position.quantity_atoms,
                        costBasisMinor: position.cost_basis_minor,
                        realizedReturnMinor: position.realized_return_minor,
                      },
                      { asOf: valuation.as_of, marketValueMinor: valuation.market_value_minor },
                    )
                  : null;
              return (
                <Card key={position.id} className='gap-3'>
                  <CardHeader className='gap-1'>
                    <div className='flex items-center justify-between gap-3'>
                      <CardTitle className='text-base'>{position.symbol}</CardTitle>
                      <span className='bg-muted rounded px-2 py-1 text-xs uppercase'>
                        {position.provider}
                      </span>
                    </div>
                    <CardDescription>
                      {position.quote_currency} quote · {position.quantity_scale} quantity places ·{' '}
                      {position.money_scale} money places
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='grid gap-2 text-sm sm:grid-cols-2'>
                    <p>
                      <span className='text-muted-foreground block text-xs'>Quantity</span>
                      <span className='font-mono tabular-nums'>
                        {formatDecimalUnits(position.quantity_atoms, position.quantity_scale)}
                      </span>
                    </p>
                    <p>
                      <span className='text-muted-foreground block text-xs'>Cost basis</span>
                      <span className='font-mono tabular-nums'>
                        {hasTrade
                          ? `${formatDecimalUnits(position.cost_basis_minor, position.money_scale)} ${position.quote_currency}`
                          : 'Not recorded'}
                      </span>
                    </p>
                    <p>
                      <span className='text-muted-foreground block text-xs'>Realized return</span>
                      <span className='font-mono tabular-nums'>
                        {signedAmount(position.realized_return_minor, position.money_scale)}{' '}
                        {position.quote_currency}
                      </span>
                    </p>
                    <p>
                      <span className='text-muted-foreground block text-xs'>
                        Manual value {valuation ? `as of ${valuation.as_of}` : ''}
                      </span>
                      <span className='font-mono tabular-nums'>
                        {valuation
                          ? `${formatDecimalUnits(valuation.market_value_minor, position.money_scale)} ${position.quote_currency}`
                          : 'No valuation'}
                      </span>
                    </p>
                    {valued && (
                      <p className='sm:col-span-2'>
                        <span className='text-muted-foreground block text-xs'>
                          Unrealized return at that value
                        </span>
                        <span className='font-mono tabular-nums'>
                          {signedAmount(valued.unrealizedReturnMinor, position.money_scale)}{' '}
                          {position.quote_currency}
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        <Card className='gap-4'>
          <CardHeader>
            <CardTitle>New manual entry</CardTitle>
            <CardDescription>Enter exact figures from a source you can review.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <label className='block space-y-1 text-sm font-medium' htmlFor='investment-action'>
              Entry type
              <select
                id='investment-action'
                value={draft.action}
                onChange={(e) => change('action', e.target.value as Action)}
                className='border-input bg-background h-9 w-full rounded-md border px-3'>
                <option value='create_position'>Create position</option>
                <option value='opening'>Opening lot</option>
                <option value='buy'>Buy</option>
                <option value='sell'>Sell</option>
                <option value='valuation'>Dated valuation</option>
              </select>
            </label>
            {draft.action === 'create_position' ? (
              <>
                <label
                  className='block space-y-1 text-sm font-medium'
                  htmlFor='investment-provider'>
                  Provider
                  <select
                    id='investment-provider'
                    value={draft.provider}
                    onChange={(e) => change('provider', e.target.value as Draft['provider'])}
                    className='border-input bg-background h-9 w-full rounded-md border px-3'>
                    <option value='tyba'>Tyba</option>
                    <option value='binance'>Binance</option>
                  </select>
                </label>
                <label className='block space-y-1 text-sm font-medium' htmlFor='investment-symbol'>
                  Symbol or fund
                  <Input
                    id='investment-symbol'
                    value={draft.symbol}
                    onChange={(e) => change('symbol', e.target.value)}
                    placeholder='Name from your statement'
                  />
                </label>
                <label className='block space-y-1 text-sm font-medium' htmlFor='investment-quote'>
                  Quote unit
                  <Input
                    id='investment-quote'
                    value={draft.quoteUnit}
                    onChange={(e) => change('quoteUnit', e.target.value)}
                    placeholder='COP, USD, USDT…'
                  />
                </label>
                <div className='grid grid-cols-2 gap-3'>
                  <label
                    className='block space-y-1 text-sm font-medium'
                    htmlFor='investment-quantity-scale'>
                    Quantity decimal places
                    <Input
                      id='investment-quantity-scale'
                      inputMode='numeric'
                      value={draft.quantityScale}
                      onChange={(e) => change('quantityScale', e.target.value)}
                    />
                  </label>
                  <label
                    className='block space-y-1 text-sm font-medium'
                    htmlFor='investment-money-scale'>
                    Money decimal places
                    <Input
                      id='investment-money-scale'
                      inputMode='numeric'
                      value={draft.moneyScale}
                      onChange={(e) => change('moneyScale', e.target.value)}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label
                  className='block space-y-1 text-sm font-medium'
                  htmlFor='investment-position'>
                  Position
                  <select
                    id='investment-position'
                    value={draft.positionId}
                    onChange={(e) => change('positionId', e.target.value)}
                    className='border-input bg-background h-9 w-full rounded-md border px-3'>
                    <option value=''>Select a position</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.provider} · {position.symbol} ({position.quote_currency})
                      </option>
                    ))}
                  </select>
                </label>
                <label className='block space-y-1 text-sm font-medium' htmlFor='investment-date'>
                  {draft.action === 'valuation' ? 'Valuation date' : 'Trade date'}
                  <Input
                    id='investment-date'
                    value={draft.date}
                    onChange={(e) => change('date', e.target.value)}
                    placeholder='YYYY-MM-DD'
                  />
                </label>
                {isTrade && (
                  <p className='text-muted-foreground text-xs'>
                    Enter the opening lot and trades in date order. Trades on the same date use
                    confirmation order for cost basis.
                  </p>
                )}
                {isTrade && (
                  <label
                    className='block space-y-1 text-sm font-medium'
                    htmlFor='investment-quantity'>
                    Quantity {selected ? `(up to ${selected.quantity_scale} places)` : ''}
                    <Input
                      id='investment-quantity'
                      inputMode='decimal'
                      value={draft.quantity}
                      onChange={(e) => change('quantity', e.target.value)}
                    />
                  </label>
                )}
                <label className='block space-y-1 text-sm font-medium' htmlFor='investment-gross'>
                  {draft.action === 'opening'
                    ? 'Known cost basis (leave blank if unknown)'
                    : draft.action === 'valuation'
                      ? 'Manual market value'
                      : 'Gross amount'}{' '}
                  {selected ? `(${selected.quote_currency})` : ''}
                  <Input
                    id='investment-gross'
                    inputMode='decimal'
                    value={draft.gross}
                    onChange={(e) => change('gross', e.target.value)}
                  />
                </label>
                {draft.action === 'opening' && /^0(?:\.0+)?$/.test(draft.gross.trim()) && (
                  <label className='flex items-start gap-2 text-sm'>
                    <input
                      type='checkbox'
                      className='mt-1'
                      checked={draft.knownZeroBasis}
                      onChange={(e) => change('knownZeroBasis', e.target.checked)}
                    />
                    I verified the opening cost basis is exactly zero
                  </label>
                )}
                {(draft.action === 'buy' || draft.action === 'sell') && (
                  <label className='block space-y-1 text-sm font-medium' htmlFor='investment-fee'>
                    Fee {selected ? `(${selected.quote_currency})` : ''}
                    <Input
                      id='investment-fee'
                      inputMode='decimal'
                      value={draft.fee}
                      onChange={(e) => change('fee', e.target.value)}
                      placeholder='0'
                    />
                  </label>
                )}
              </>
            )}
            <div className='border-border border-t pt-4'>
              <p className='mb-3 text-sm font-semibold'>Evidence</p>
              <div className='space-y-3'>
                <label
                  className='block space-y-1 text-sm font-medium'
                  htmlFor='investment-reference'>
                  Evidence reference
                  <Input
                    id='investment-reference'
                    value={draft.evidenceReference}
                    onChange={(e) => change('evidenceReference', e.target.value)}
                    placeholder='Statement, trade ID, or note'
                  />
                </label>
                <label
                  className='block space-y-1 text-sm font-medium'
                  htmlFor='investment-evidence-date'>
                  Evidence date
                  <Input
                    id='investment-evidence-date'
                    value={draft.evidenceDate}
                    onChange={(e) => change('evidenceDate', e.target.value)}
                    placeholder='YYYY-MM-DD'
                  />
                </label>
              </div>
            </div>
            {!reviewEvent ? (
              <Button type='button' onClick={review} className='w-full'>
                Review entry <ArrowRight className='ml-2 h-4 w-4' />
              </Button>
            ) : (
              <div className='border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-4'>
                <h3 className='font-semibold'>Review before saving</h3>
                <p className='text-sm'>
                  This {reviewEvent.action.replace('_', ' ')} entry will be stored only in the
                  manual investment journal.
                </p>
                <pre className='bg-background max-h-48 overflow-auto rounded p-3 text-xs whitespace-pre-wrap'>
                  {JSON.stringify(reviewEvent, null, 2)}
                </pre>
                <label className='flex items-start gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className='mt-1'
                  />
                  I checked these details against the evidence
                </label>
                <Button
                  type='button'
                  onClick={() => void confirm()}
                  disabled={!checked || saving}
                  className='w-full'>
                  {saving ? 'Saving…' : 'Confirm reviewed entry'}
                </Button>
              </div>
            )}
            {needsPosition && !selected && (
              <p className='text-muted-foreground text-xs'>
                Create or select a position before recording a lot, trade, or value.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
