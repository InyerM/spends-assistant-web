'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WealthRecordControlsProps {
  kind: 'investment' | 'loan';
  id: string;
  name: string;
  hasEvents: boolean;
  archived: boolean;
  onChanged: () => void | Promise<void>;
}

export function WealthRecordControls({
  kind,
  id,
  name,
  hasEvents,
  archived,
  onChanged,
}: WealthRecordControlsProps): React.ReactElement {
  const t = useTranslations('wealth.controls');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/${kind === 'investment' ? 'investments' : 'loans'}/${id}`;

  const request = async (
    method: 'PATCH' | 'DELETE',
    action?: string,
    label?: string,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method,
        ...(method === 'PATCH'
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, ...(label === undefined ? {} : { label }) }),
            }
          : {}),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t('saveFailed'));
      }
      setEditing(false);
      setConfirmDelete(false);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='border-border space-y-3 border-t pt-4'>
      {editing ? (
        <div className='flex flex-wrap items-end gap-2'>
          <label className='min-w-0 flex-1 space-y-1 text-sm'>
            {t('name')}
            <Input
              aria-label={t('name')}
              value={draft}
              maxLength={kind === 'investment' ? 80 : 100}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <Button
            size='sm'
            disabled={busy || !draft.trim()}
            onClick={() => void request('PATCH', 'rename', draft.trim())}>
            {t('save')}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setDraft(name);
            }}>
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <div className='flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={busy}
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}>
            {t('editName')}
          </Button>
          <Button
            size='sm'
            variant='outline'
            disabled={busy}
            onClick={() => void request('PATCH', archived ? 'restore' : 'archive')}>
            {archived ? t('restore') : t('archive')}
          </Button>
          {!hasEvents && (
            <Button
              size='sm'
              variant='ghost'
              disabled={busy}
              onClick={() => setConfirmDelete(true)}>
              {t('delete')}
            </Button>
          )}
        </div>
      )}
      {confirmDelete && (
        <div className='border-destructive/30 bg-destructive/5 space-y-2 rounded-xl border p-4 text-sm'>
          <p>{t('deleteWarning')}</p>
          <div className='mt-2 flex gap-2'>
            <Button
              size='sm'
              variant='destructive'
              disabled={busy}
              onClick={() => void request('DELETE')}>
              {t('confirmDelete')}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              disabled={busy}
              onClick={() => setConfirmDelete(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role='alert' className='text-destructive text-xs'>
          {error}
        </p>
      )}
    </div>
  );
}
