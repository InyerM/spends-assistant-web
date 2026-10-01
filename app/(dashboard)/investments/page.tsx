'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, BookOpenCheck, CircleAlert, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { WealthRecordControls } from '@/components/wealth/wealth-record-controls';
import { WealthEventLink } from '@/components/wealth/wealth-event-link';
import { applyPositionTrade, valuePosition } from '@/lib/wealth/calculations';
import { formatLocalizedDecimalUnits, parseDecimalUnits } from '@/lib/wealth/decimal';
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
  archived_at?: string | null;
  investment_trades?: {
    id: string;
    kind?: 'opening' | 'buy' | 'sell';
    occurred_on: string;
    quantity_atoms?: string;
    gross_minor?: string;
    source_transaction_id?: string | null;
  }[];
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

function signedAmount(value: string, scale: number, locale: string): string {
  return value.startsWith('-')
    ? `-${formatLocalizedDecimalUnits(value.slice(1), scale, locale)}`
    : formatLocalizedDecimalUnits(value, scale, locale);
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
  const t = useTranslations('wealth.investments');
  const locale = useLocale();
  const loadError = t('loadFailed');
  const [positions, setPositions] = useState<SavedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [reviewEvent, setReviewEvent] = useState<InvestmentEventDraft | null>(null);
  const [checked, setChecked] = useState(false);
  const [historyView, setHistoryView] = useState(false);
  const requestId = useRef<string | null>(null);

  const loadPositions = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/investments');
    if (!response.ok) throw new Error(loadError);
    const body = (await response.json()) as { data?: SavedPosition[] };
    setPositions(body.data ?? []);
  }, [loadError]);

  useEffect(() => {
    void loadPositions()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : loadError);
      })
      .finally(() => setLoading(false));
  }, [loadPositions, loadError]);

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
        throw new Error(t('scaleRequired'));
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
    if (!position) throw new Error(t('selectPositionError'));
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
      throw new Error(t('dateOrderError', { date: latestTradeDate }));
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
      setError(cause instanceof Error ? cause.message : t('checkSource'));
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
        throw new Error(body.error ?? t('saveFailed'));
      }
      await loadPositions();
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

  const selected = positions.find((item) => item.id === draft.positionId);
  const isTrade = draft.action === 'opening' || draft.action === 'buy' || draft.action === 'sell';
  const needsPosition = draft.action !== 'create_position';
  const currentPositions = positions.filter(
    (position) =>
      !position.archived_at &&
      ((position.investment_trades?.length ?? 0) === 0 || position.quantity_atoms !== '0'),
  );
  const historicalPositions = positions.filter(
    (position) =>
      !!position.archived_at ||
      ((position.investment_trades?.length ?? 0) > 0 && position.quantity_atoms === '0'),
  );
  const visiblePositions = historyView ? historicalPositions : currentPositions;

  return (
    <main className='mx-auto max-w-6xl space-y-6 p-4 sm:p-6'>
      <header className='space-y-2'>
        <div className='flex items-center gap-3'>
          <div className='bg-primary/10 text-primary rounded-xl p-2.5'>
            <TrendingUp className='h-5 w-5' />
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
        <div
          role='alert'
          className='border-destructive/30 bg-destructive/5 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm'>
          <CircleAlert className='h-4 w-4' />
          {error}
        </div>
      )}

      <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]'>
        <section className='space-y-3' aria-label={t('section')}>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <h2 className='text-lg font-semibold'>{t('section')}</h2>
              <p className='text-muted-foreground text-sm'>{t('sectionHint')}</p>
            </div>
            <div className='bg-muted flex self-start rounded-lg p-1 text-sm'>
              <Button
                size='sm'
                variant={!historyView ? 'secondary' : 'ghost'}
                onClick={() => setHistoryView(false)}>
                {t('current')} ({currentPositions.length})
              </Button>
              <Button
                size='sm'
                variant={historyView ? 'secondary' : 'ghost'}
                onClick={() => setHistoryView(true)}>
                {t('history')} ({historicalPositions.length})
              </Button>
            </div>
          </div>
          {loading ? (
            <p className='text-muted-foreground text-sm'>{t('loading')}</p>
          ) : visiblePositions.length === 0 ? (
            <Card>
              <CardContent className='space-y-2 pt-6'>
                <BookOpenCheck className='text-muted-foreground h-6 w-6' />
                <p className='font-medium'>
                  {positions.length === 0
                    ? t('empty')
                    : historyView
                      ? t('noHistory')
                      : t('noCurrent')}
                </p>
                <p className='text-muted-foreground text-sm'>
                  {positions.length === 0 ? t('emptyHint') : null}
                </p>
              </CardContent>
            </Card>
          ) : (
            visiblePositions.map((position) => {
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
                    {(position.archived_at || (hasTrade && position.quantity_atoms === '0')) && (
                      <span className='text-muted-foreground text-xs'>
                        {position.archived_at ? t('archived') : t('settled')}
                      </span>
                    )}
                    <CardDescription>
                      {t('positionMetadata', {
                        currency: position.quote_currency,
                        quantityPlaces: position.quantity_scale,
                        moneyPlaces: position.money_scale,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='grid gap-3 text-sm sm:grid-cols-2'>
                    <p>
                      <span className='text-muted-foreground block text-xs'>{t('quantity')}</span>
                      <span className='font-mono tabular-nums'>
                        {formatLocalizedDecimalUnits(
                          position.quantity_atoms,
                          position.quantity_scale,
                          locale,
                        )}
                      </span>
                    </p>
                    <p>
                      <span className='text-muted-foreground block text-xs'>{t('costBasis')}</span>
                      <span className='font-mono tabular-nums'>
                        {hasTrade
                          ? `${formatLocalizedDecimalUnits(position.cost_basis_minor, position.money_scale, locale)} ${position.quote_currency}`
                          : t('notRecorded')}
                      </span>
                    </p>
                    <p>
                      <span className='text-muted-foreground block text-xs'>
                        {t('realizedReturn')}
                      </span>
                      <span className='font-mono tabular-nums'>
                        {signedAmount(position.realized_return_minor, position.money_scale, locale)}{' '}
                        {position.quote_currency}
                      </span>
                    </p>
                    <p>
                      <span className='text-muted-foreground block text-xs'>
                        {t('manualValue')} {valuation ? t('asOf', { date: valuation.as_of }) : ''}
                      </span>
                      <span className='font-mono tabular-nums'>
                        {valuation
                          ? `${formatLocalizedDecimalUnits(valuation.market_value_minor, position.money_scale, locale)} ${position.quote_currency}`
                          : t('noValuation')}
                      </span>
                    </p>
                    {valued && (
                      <p className='sm:col-span-2'>
                        <span className='text-muted-foreground block text-xs'>
                          {t('unrealizedReturn')}
                        </span>
                        <span className='font-mono tabular-nums'>
                          {signedAmount(valued.unrealizedReturnMinor, position.money_scale, locale)}{' '}
                          {position.quote_currency}
                        </span>
                      </p>
                    )}
                    {(position.investment_trades?.length ?? 0) +
                      (position.investment_valuations?.length ?? 0) >
                      0 && (
                      <details className='border-border border-t pt-3 sm:col-span-2'>
                        <summary className='cursor-pointer font-medium'>
                          {t('recordedEvents', {
                            count:
                              (position.investment_trades?.length ?? 0) +
                              (position.investment_valuations?.length ?? 0),
                          })}
                        </summary>
                        <ul className='mt-2 divide-y'>
                          {[
                            ...(position.investment_trades ?? []).map((event) => ({
                              id: event.id,
                              date: event.occurred_on,
                              eventType: event.kind ?? 'buy',
                              transactionId: event.source_transaction_id ?? null,
                              label: t('tradeSummary', {
                                kind:
                                  event.kind === 'opening'
                                    ? t('openingLot')
                                    : event.kind === 'sell'
                                      ? t('sell')
                                      : t('buy'),
                                quantity: formatLocalizedDecimalUnits(
                                  event.quantity_atoms ?? '0',
                                  position.quantity_scale,
                                  locale,
                                ),
                                gross: formatLocalizedDecimalUnits(
                                  event.gross_minor ?? '0',
                                  position.money_scale,
                                  locale,
                                ),
                                currency: position.quote_currency,
                              }),
                            })),
                            ...(position.investment_valuations ?? []).map((event) => ({
                              id: event.id,
                              date: event.as_of,
                              eventType: null,
                              transactionId: null,
                              label: t('valuationSummary', {
                                value: formatLocalizedDecimalUnits(
                                  event.market_value_minor,
                                  position.money_scale,
                                  locale,
                                ),
                                currency: position.quote_currency,
                              }),
                            })),
                          ]
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map((event) => (
                              <li key={event.id} className='py-2'>
                                <div className='flex flex-wrap justify-between gap-2'>
                                  <span>{event.label}</span>
                                  <time className='text-muted-foreground'>{event.date}</time>
                                </div>
                                {event.eventType && (
                                  <WealthEventLink
                                    kind='investment_trade'
                                    eventType={event.eventType}
                                    eventId={event.id}
                                    date={event.date}
                                    transactionId={event.transactionId}
                                    onChanged={loadPositions}
                                  />
                                )}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                    <div className='border-border border-t pt-3 sm:col-span-2'>
                      <WealthRecordControls
                        kind='investment'
                        id={position.id}
                        name={position.symbol}
                        hasEvents={hasTrade || (position.investment_valuations?.length ?? 0) > 0}
                        archived={!!position.archived_at}
                        onChanged={loadPositions}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>

        <Card className='gap-4'>
          <CardHeader>
            <CardTitle>{t('newEntry')}</CardTitle>
            <CardDescription>{t('entryHint')}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <label className='block space-y-1 text-sm font-medium' htmlFor='investment-action'>
              {t('entryType')}
              <select
                id='investment-action'
                value={draft.action}
                onChange={(e) => change('action', e.target.value as Action)}
                className='border-input bg-background h-9 w-full rounded-md border px-3'>
                <option value='create_position'>{t('createPosition')}</option>
                <option value='opening'>{t('openingLot')}</option>
                <option value='buy'>{t('buy')}</option>
                <option value='sell'>{t('sell')}</option>
                <option value='valuation'>{t('datedValuation')}</option>
              </select>
            </label>
            {draft.action === 'create_position' ? (
              <>
                <label
                  className='block space-y-1 text-sm font-medium'
                  htmlFor='investment-provider'>
                  {t('provider')}
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
                  {t('symbol')}
                  <Input
                    id='investment-symbol'
                    value={draft.symbol}
                    onChange={(e) => change('symbol', e.target.value)}
                    placeholder={t('symbolHint')}
                  />
                </label>
                <label className='block space-y-1 text-sm font-medium' htmlFor='investment-quote'>
                  {t('quoteUnit')}
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
                    {t('quantityPlaces')}
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
                    {t('moneyPlaces')}
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
                  {t('position')}
                  <select
                    id='investment-position'
                    value={draft.positionId}
                    onChange={(e) => change('positionId', e.target.value)}
                    className='border-input bg-background h-9 w-full rounded-md border px-3'>
                    <option value=''>{t('selectPosition')}</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.provider} · {position.symbol} ({position.quote_currency})
                      </option>
                    ))}
                  </select>
                </label>
                <label className='block space-y-1 text-sm font-medium' htmlFor='investment-date'>
                  {draft.action === 'valuation' ? t('valuationDate') : t('tradeDate')}
                  <Input
                    id='investment-date'
                    value={draft.date}
                    onChange={(e) => change('date', e.target.value)}
                    placeholder='YYYY-MM-DD'
                  />
                </label>
                {isTrade && <p className='text-muted-foreground text-xs'>{t('dateOrderHint')}</p>}
                {isTrade && (
                  <label
                    className='block space-y-1 text-sm font-medium'
                    htmlFor='investment-quantity'>
                    {t('quantity')}{' '}
                    {selected ? t('quantityLimit', { count: selected.quantity_scale }) : ''}
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
                    ? t('knownBasis')
                    : draft.action === 'valuation'
                      ? t('marketValue')
                      : t('grossAmount')}{' '}
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
                    {t('zeroBasisChecked')}
                  </label>
                )}
                {(draft.action === 'buy' || draft.action === 'sell') && (
                  <label className='block space-y-1 text-sm font-medium' htmlFor='investment-fee'>
                    {t('fee')} {selected ? `(${selected.quote_currency})` : ''}
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
              <p className='mb-3 text-sm font-semibold'>{t('evidence')}</p>
              <div className='space-y-3'>
                <label
                  className='block space-y-1 text-sm font-medium'
                  htmlFor='investment-reference'>
                  {t('evidenceReference')}
                  <Input
                    id='investment-reference'
                    value={draft.evidenceReference}
                    onChange={(e) => change('evidenceReference', e.target.value)}
                    placeholder={t('evidenceHint')}
                  />
                </label>
                <label
                  className='block space-y-1 text-sm font-medium'
                  htmlFor='investment-evidence-date'>
                  {t('evidenceDate')}
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
                {t('reviewEntry')} <ArrowRight className='ml-2 h-4 w-4' />
              </Button>
            ) : (
              <div className='border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-4'>
                <h3 className='font-semibold'>{t('reviewBeforeSaving')}</h3>
                <p className='text-sm'>
                  {t('reviewPreview', {
                    action:
                      reviewEvent.action === 'create_position'
                        ? t('createPosition')
                        : reviewEvent.action === 'opening'
                          ? t('openingLot')
                          : reviewEvent.action === 'valuation'
                            ? t('datedValuation')
                            : t(reviewEvent.action),
                  })}
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
                  {t('checked')}
                </label>
                <Button
                  type='button'
                  onClick={() => void confirm()}
                  disabled={!checked || saving}
                  className='w-full'>
                  {saving ? t('saving') : t('confirm')}
                </Button>
              </div>
            )}
            {needsPosition && !selected && (
              <p className='text-muted-foreground text-xs'>{t('selectPositionHint')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
