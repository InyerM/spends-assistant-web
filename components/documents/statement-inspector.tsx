'use client';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineLoader } from '@/components/shared/loader';
import type { StatementHints } from '@/lib/statement-hints';
const inspection = z.object({
  hints: z.object({
    account_id: z.string().nullable(),
    last_four: z.string().nullable(),
    period_start: z.string().nullable(),
    period_end: z.string().nullable(),
    cycle: z.enum(['monthly', 'quarterly', 'other']).nullable(),
  }),
});
const inspectionError = z.object({ code: z.string().optional() });
export function StatementInspector({
  documentId,
  onHints,
}: {
  documentId: string;
  onHints: (hints: StatementHints) => void;
}): React.ReactElement {
  const t = useTranslations('statementReconciliation');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cycle, setCycle] = useState<StatementHints['cycle']>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/documents/${documentId}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    })
      .then(async (response) => {
        const value: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (response.ok) {
          const result = inspection.parse(value);
          onHints(result.hints);
          setCycle(result.hints.cycle);
        } else if (
          inspectionError.parse(value).code === 'PDF_PASSWORD_REQUIRED' ||
          inspectionError.parse(value).code === 'PDF_PASSWORD_INCORRECT'
        )
          setNeedsPassword(true);
        else setError(true);
      })
      .catch((): void => {
        if (!controller.signal.aborted) setError(true);
      });
    return (): void => controller.abort();
  }, [documentId, onHints]);
  async function inspect(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/documents/${documentId}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      setPassword('');
      const value: unknown = await response.json();
      if (!response.ok) throw new Error('Inspection failed');
      const result = inspection.parse(value);
      onHints(result.hints);
      setCycle(result.hints.cycle);
      setNeedsPassword(false);
    } catch {
      setError(true);
    } finally {
      setPassword('');
      setBusy(false);
    }
  }
  async function showPdf(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/documents/${documentId}/inspect`);
      if (!response.ok) throw new Error('PDF unavailable');
      const value: unknown = await response.json();
      setPreview(z.object({ url: z.url() }).parse(value).url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className='border-border min-w-0 space-y-3 rounded-xl border p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground max-w-xl text-sm'>{t('detectionHint')}</p>
        <Button
          variant='outline'
          disabled={busy}
          onClick={() => (preview ? setPreview(null) : void showPdf())}>
          {t(preview ? 'hidePdf' : 'viewPdf')}
        </Button>
      </div>
      {needsPassword && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void inspect();
          }}
          className='space-y-2'>
          <label htmlFor={`statement-key-${documentId}`} className='text-sm'>
            {t('pdfPassword')}
          </label>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Input
              id={`statement-key-${documentId}`}
              type='password'
              autoComplete='off'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={128}
            />
            <Button type='submit' disabled={busy || !password}>
              {t('detect')}
            </Button>
          </div>
          <p className='text-muted-foreground text-xs'>{t('passwordHint')}</p>
        </form>
      )}
      {cycle && (
        <p className='text-primary text-sm' role='status'>
          {t('cycleDetected', { cycle: t(`cycles.${cycle}`) })}
        </p>
      )}
      {busy && <InlineLoader />}
      {error && (
        <p role='alert' className='text-warning text-sm'>
          {t('detectionError')}
        </p>
      )}
      {preview && (
        <div className='space-y-2'>
          <iframe
            title={t('pdfTitle')}
            src={preview}
            className='h-[60dvh] min-h-80 w-full rounded-lg border'
            referrerPolicy='no-referrer'
          />
          <a
            href={preview}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary text-sm underline'>
            {t('openPdf')}
          </a>
        </div>
      )}
    </div>
  );
}
