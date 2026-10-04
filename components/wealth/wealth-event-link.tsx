'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { dateWindow } from '@/lib/document-reconciliation';

interface Candidate {
  id: string;
  date: string;
  amount: number;
  type: string;
  description: string;
}

interface WealthEventLinkProps {
  kind: 'investment_trade' | 'loan_event';
  eventType: 'opening' | 'buy' | 'sell' | 'payment';
  eventId: string;
  date: string;
  transactionId: string | null;
  onChanged: () => void | Promise<void>;
}

export function WealthEventLink({
  kind,
  eventType,
  eventId,
  date,
  transactionId,
  onChanged,
}: WealthEventLinkProps): React.ReactElement {
  const t = useTranslations('wealth.links');
  const [editing, setEditing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState(transactionId ?? '');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async (): Promise<void> => {
    setEditing(true);
    setBusy(true);
    setError(null);
    try {
      const window = dateWindow(date);
      const params = new URLSearchParams({
        date_from: window?.from ?? date,
        date_to: window?.to ?? date,
        limit: '100',
      });
      const response = await fetch(`/api/transactions?${params.toString()}`);
      if (!response.ok) throw new Error(t('searchFailed'));
      const body = (await response.json()) as { data?: Candidate[] };
      const incoming = eventType === 'sell' || (kind === 'loan_event' && eventType === 'opening');
      setCandidates(
        (body.data ?? []).filter(
          (item) => item.type === 'transfer' || item.type === (incoming ? 'income' : 'expense'),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('searchFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (): Promise<void> => {
    if (!checked || busy || (!selected && !transactionId)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/wealth-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          event_id: eventId,
          transaction_id: selected || null,
          reviewed: true,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t('linkFailed'));
      }
      setEditing(false);
      setChecked(false);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('linkFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='space-y-2 text-xs'>
      <div className='flex flex-wrap items-center gap-3'>
        {transactionId && (
          <Link
            href={`/transactions/${transactionId}`}
            className='text-success hover:text-success/80 focus-visible:ring-ring rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none'>
            {t('viewTransaction')}
          </Link>
        )}
        <Button size='sm' variant='ghost' disabled={busy} onClick={() => void open()}>
          {transactionId ? t('changeLink') : t('linkTransaction')}
        </Button>
      </div>
      {editing && (
        <div className='border-brand-secondary/25 bg-brand-secondary/5 space-y-4 rounded-xl border p-4'>
          <p className='text-muted-foreground'>{t('reviewHint')}</p>
          <label className='block space-y-1'>
            {t('selectTransaction')}
            <select
              aria-label={t('selectTransaction')}
              className='border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full min-w-0 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setChecked(false);
              }}>
              <option value=''>{transactionId ? t('unlink') : t('selectTransaction')}</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.date} · {candidate.description} · {candidate.amount}
                </option>
              ))}
            </select>
          </label>
          {candidates.length === 0 && !busy && (
            <p className='text-muted-foreground'>{t('noCandidates')}</p>
          )}
          <label className='flex items-start gap-2'>
            <input
              type='checkbox'
              className='accent-success h-4 w-4 shrink-0'
              aria-label={t('checked')}
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            {t('checked')}
          </label>
          <div className='flex gap-2'>
            <Button
              size='sm'
              disabled={busy || !checked || (!selected && !transactionId)}
              onClick={() => void confirm()}>
              {t('confirmLink')}
            </Button>
            <Button size='sm' variant='ghost' disabled={busy} onClick={() => setEditing(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role='alert' className='text-destructive'>
          {error}
        </p>
      )}
    </div>
  );
}
