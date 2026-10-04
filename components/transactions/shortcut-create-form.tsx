'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface AccountOption {
  id: string;
  name: string;
}
interface CategoryOption {
  id: string;
  name: string;
  type: string;
}
interface Candidate {
  id: string;
  date: string;
  amount: string;
  description: string;
  source: string;
}
interface CandidateReview {
  status: 'review_required' | 'review_overflow';
  candidate_hash?: string;
  candidate_count: number;
  candidates: Candidate[];
}

function bogotaDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (kind: string): string => parts.find(({ type }) => type === kind)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function ShortcutCreateForm({
  inboxId,
  receivedAt,
  onCreated,
  onCancel,
}: {
  inboxId: string;
  receivedAt: string;
  onCreated: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [optionsError, setOptionsError] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => bogotaDate(receivedAt));
  const [eventTime, setEventTime] = useState('');
  const [eventTimeConfirmed, setEventTimeConfirmed] = useState(false);
  const [description, setDescription] = useState('');
  const [review, setReview] = useState<CandidateReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch('/api/accounts', { cache: 'no-store' }),
      fetch('/api/categories', { cache: 'no-store' }),
    ])
      .then(async ([accountResponse, categoryResponse]) => {
        if (!accountResponse.ok || !categoryResponse.ok) throw new Error('Options unavailable');
        const [accountRows, categoryRows] = await Promise.all([
          accountResponse.json() as Promise<AccountOption[]>,
          categoryResponse.json() as Promise<CategoryOption[]>,
        ]);
        if (active) {
          setAccounts(accountRows);
          setCategories(categoryRows);
        }
      })
      .catch(() => {
        if (active) setOptionsError(true);
      });
    return (): void => {
      active = false;
    };
  }, []);

  const clearReview = (): void => {
    setReview(null);
    setError(null);
  };
  const submit = async (confirmDistinct = false): Promise<void> => {
    if (eventTime && !eventTimeConfirmed) {
      setError(t('eventTimeNeedsConfirmation'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/shortcut-inbox/${inboxId}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          category_id: categoryId,
          type,
          amount,
          date,
          description,
          ...(eventTime
            ? { event_at: `${date}T${eventTime}:00-05:00`, event_time_confirmed: true }
            : {}),
          ...(confirmDistinct && review?.status === 'review_required'
            ? {
                reviewed_candidate_hash: review.candidate_hash,
                confirm_distinct: true,
              }
            : {}),
        }),
      });
      const result = (await response.json()) as
        | CandidateReview
        | { status?: string; error?: string };
      if (
        response.status === 409 &&
        (result.status === 'review_required' || result.status === 'review_overflow')
      ) {
        setReview(result as CandidateReview);
        return;
      }
      if (!response.ok) throw new Error('Creation failed');
      onCreated();
    } catch {
      setError(t('createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className='border-border bg-card-overlay space-y-4 rounded-xl border p-4 text-sm'
      onSubmit={(event): void => {
        event.preventDefault();
        void submit();
      }}>
      <p className='font-medium'>{t('createTitle')}</p>
      <p className='text-muted-foreground'>{t('createCaution')}</p>
      {optionsError && (
        <p role='alert' className='text-destructive'>
          {t('optionsFailed')}
        </p>
      )}
      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='space-y-1'>
          {t('createAccount')}
          <select
            className='border-input bg-card block w-full rounded-md border p-2'
            value={accountId}
            required
            onChange={(event): void => {
              setAccountId(event.target.value);
              clearReview();
            }}>
            <option value=''>{t('chooseAccount')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className='space-y-1'>
          {t('createType')}
          <select
            className='border-input bg-card block w-full rounded-md border p-2'
            value={type}
            onChange={(event): void => {
              setType(event.target.value as 'expense' | 'income');
              setCategoryId('');
              clearReview();
            }}>
            <option value='expense'>{t('expense')}</option>
            <option value='income'>{t('income')}</option>
          </select>
        </label>
        <label className='space-y-1'>
          {t('createCategory')}
          <select
            className='border-input bg-card block w-full rounded-md border p-2'
            value={categoryId}
            required
            onChange={(event): void => {
              setCategoryId(event.target.value);
              clearReview();
            }}>
            <option value=''>{t('chooseCategory')}</option>
            {categories
              .filter((category) => category.type === type)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </label>
        <label className='space-y-1'>
          {t('createAmount')}
          <input
            className='border-input bg-card block w-full rounded-md border p-2'
            type='text'
            inputMode='decimal'
            pattern='(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?'
            value={amount}
            required
            onChange={(event): void => {
              setAmount(event.target.value);
              clearReview();
            }}
          />
        </label>
        <label className='space-y-1'>
          {t('createDate')}
          <input
            className='border-input bg-card block w-full rounded-md border p-2'
            type='date'
            value={date}
            required
            onChange={(event): void => {
              setDate(event.target.value);
              setEventTimeConfirmed(false);
              clearReview();
            }}
          />
        </label>
        <label className='space-y-1'>
          {t('createEventTime')}
          <input
            className='border-input bg-card block w-full rounded-md border p-2'
            type='time'
            step={60}
            value={eventTime}
            onChange={(event): void => {
              setEventTime(event.target.value);
              setEventTimeConfirmed(false);
              clearReview();
            }}
          />
        </label>
        {eventTime && (
          <label className='flex items-center gap-2 sm:col-span-2'>
            <input
              type='checkbox'
              checked={eventTimeConfirmed}
              onChange={(event): void => {
                setEventTimeConfirmed(event.target.checked);
                clearReview();
              }}
            />
            {t('confirmEventTime')}
          </label>
        )}
        <label className='space-y-1 sm:col-span-2'>
          {t('createDescription')}
          <input
            className='border-input bg-card block w-full rounded-md border p-2'
            type='text'
            maxLength={500}
            value={description}
            required
            onChange={(event): void => {
              setDescription(event.target.value);
              clearReview();
            }}
          />
        </label>
      </div>
      {error && (
        <p role='alert' className='text-destructive'>
          {error}
        </p>
      )}
      {review && (
        <div className='border-brand-secondary/30 bg-brand-secondary/5 space-y-2 rounded-lg border p-3'>
          <p>
            {review.status === 'review_overflow'
              ? t('overflowCaution')
              : t('distinctCaution', { count: review.candidate_count })}
          </p>
          {review.candidates.map((candidate) => (
            <p key={candidate.id}>
              {candidate.date} · {candidate.amount} · {candidate.description} · {candidate.source}
            </p>
          ))}
          {review.status === 'review_required' && (
            <Button type='button' disabled={busy} onClick={(): void => void submit(true)}>
              {t('confirmDistinct')}
            </Button>
          )}
        </div>
      )}
      <div className='flex gap-2'>
        {!review && (
          <Button type='submit' disabled={busy || optionsError}>
            {t('saveReviewed')}
          </Button>
        )}
        <Button type='button' variant='outline' disabled={busy} onClick={onCancel}>
          {t('cancelCreate')}
        </Button>
      </div>
    </form>
  );
}
