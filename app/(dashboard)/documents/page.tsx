'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileImage, LoaderCircle, ScanText, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MAX_DOCUMENT_BYTES } from '@/lib/documents';

interface Observation {
  id: string;
  ordinal: number;
  amount: number | null;
  currency: string | null;
  occurred_at_text: string | null;
  description: string;
  counterparty: string | null;
  reference: string | null;
  source_excerpt: string;
  confidence: number;
  status: string;
}

interface Document {
  id: string;
  file_name: string;
  document_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  document_observations: Observation[];
}

interface Candidate {
  kind: 'candidate';
  transaction_id: string;
  amount: number;
  amount_difference: number;
  date: string;
  description: string;
  account_name: string | null;
  basis: 'exact_date' | 'near_date' | 'amount_only';
  reference_hint: boolean;
  description_hint: boolean;
}

interface SuggestionGroup {
  observation_id: string;
  status: string;
  candidates: Candidate[];
  total_candidates: number;
  search_limited: boolean;
}

function SuggestionPanel({
  group,
}: {
  group: SuggestionGroup | undefined;
}): React.ReactElement | null {
  const t = useTranslations('documents');
  if (!group) return null;
  if (group.status !== 'pending') {
    return <p className='text-muted-foreground mt-3 text-xs'>{t('alreadyReviewed')}</p>;
  }
  if (group.candidates.length === 0) {
    return <p className='text-muted-foreground mt-3 text-sm'>{t('noCandidates')}</p>;
  }
  return (
    <div className='border-border mt-4 space-y-2 border-t pt-3'>
      {group.candidates.map((candidate) => (
        <div key={candidate.transaction_id} className='border-border bg-card rounded-lg border p-3'>
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <div>
              <div className='flex items-center gap-2'>
                <p className='text-sm font-medium'>{candidate.description}</p>
                <Badge variant='outline'>{t('candidate')}</Badge>
              </div>
              <p className='text-muted-foreground mt-1 text-xs'>
                {[candidate.date, candidate.account_name, t(`basis.${candidate.basis}`)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <span className='text-sm font-semibold tabular-nums'>
              {candidate.amount.toLocaleString()}
            </span>
          </div>
          <p className='text-muted-foreground mt-2 text-xs'>
            {t('amountDifference', { amount: candidate.amount_difference })}
            {candidate.reference_hint ? ` · ${t('referenceHint')}` : ''}
            {candidate.description_hint ? ` · ${t('descriptionHint')}` : ''}
          </p>
        </div>
      ))}
      {group.total_candidates > group.candidates.length && (
        <p className='text-muted-foreground text-xs'>
          {t('showingCandidates', {
            shown: group.candidates.length,
            total: group.total_candidates,
          })}
        </p>
      )}
      {group.search_limited && (
        <p className='text-muted-foreground text-xs'>{t('searchLimited')}</p>
      )}
    </div>
  );
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? 'Request failed';
}

export default function DocumentsPage(): React.ReactElement {
  const t = useTranslations('documents');
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Partial<Record<string, SuggestionGroup[]>>>({});
  const [suggestionBusy, setSuggestionBusy] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as { data: Document[] };
      setDocuments(result.data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File): Promise<void> => {
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > MAX_DOCUMENT_BYTES ||
      file.size === 0
    ) {
      setError(t('invalidFile'));
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/documents', { method: 'POST', body });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('uploadFailed'));
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const extract = async (id: string): Promise<void> => {
    setBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${id}/extract`, { method: 'POST' });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('extractFailed'));
    } finally {
      setBusy(null);
    }
  };

  const findSuggestions = async (id: string): Promise<void> => {
    setSuggestionBusy(id);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${id}/suggestions`);
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as { data: SuggestionGroup[] };
      setSuggestions((current) => ({ ...current, [id]: result.data }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('suggestionsFailed'));
    } finally {
      setSuggestionBusy(null);
    }
  };

  return (
    <div className='mx-auto max-w-5xl space-y-6 p-4 sm:p-6'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h2 className='text-foreground text-2xl font-semibold'>{t('title')}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>{t('subtitle')}</p>
        </div>
        <input
          ref={inputRef}
          className='sr-only'
          type='file'
          accept='image/png,image/jpeg,image/webp'
          aria-label={t('chooseImage')}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button disabled={busy !== null} onClick={() => inputRef.current?.click()}>
          {busy === 'upload' ? (
            <LoaderCircle className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Upload className='mr-2 h-4 w-4' />
          )}
          {busy === 'upload' ? t('uploading') : t('upload')}
        </Button>
      </div>

      {error && (
        <p
          role='alert'
          className='text-destructive rounded-lg border border-current/20 p-3 text-sm'>
          {error}
        </p>
      )}
      {loading ? (
        <p className='text-muted-foreground text-sm'>{t('loading')}</p>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center py-12 text-center'>
            <FileImage className='text-muted-foreground mb-3 h-10 w-10' />
            <p className='font-medium'>{t('empty')}</p>
            <p className='text-muted-foreground mt-1 text-sm'>{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {documents.map((document) => (
            <Card key={document.id} className='gap-0 py-0'>
              <CardContent className='space-y-4 p-5'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='flex min-w-0 items-start gap-3'>
                    <span className='bg-primary/10 text-primary rounded-lg p-2'>
                      <FileImage className='h-5 w-5' />
                    </span>
                    <div className='min-w-0'>
                      <h3 className='truncate font-medium'>{document.file_name}</h3>
                      <p className='text-muted-foreground mt-1 text-xs'>
                        {new Date(document.created_at).toLocaleString()} ·{' '}
                        {document.document_type
                          ? t(`type.${document.document_type}`)
                          : t('unclassified')}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline'>{t(`status.${document.status}`)}</Badge>
                    {(document.status === 'uploaded' ||
                      document.status === 'failed' ||
                      (document.status === 'processing' &&
                        Date.now() - new Date(document.updated_at).getTime() > 5 * 60 * 1000)) && (
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={busy !== null}
                        onClick={() => void extract(document.id)}>
                        {busy === document.id ? (
                          <LoaderCircle className='mr-2 h-4 w-4 animate-spin' />
                        ) : (
                          <ScanText className='mr-2 h-4 w-4' />
                        )}
                        {busy === document.id ? t('extracting') : t('extract')}
                      </Button>
                    )}
                  </div>
                </div>
                {document.status === 'extracted' && (
                  <div className='border-border space-y-3 border-t pt-4'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                        {t('observations')}
                      </p>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={suggestionBusy !== null}
                        onClick={() => void findSuggestions(document.id)}>
                        {suggestionBusy === document.id
                          ? t('findingSuggestions')
                          : t('findSuggestions')}
                      </Button>
                    </div>
                    {suggestions[document.id] && (
                      <p className='text-muted-foreground text-xs'>{t('candidateOnly')}</p>
                    )}
                    {document.document_observations.length === 0 ? (
                      <p className='text-muted-foreground text-sm'>{t('noObservations')}</p>
                    ) : (
                      [...document.document_observations]
                        .sort((a, b) => a.ordinal - b.ordinal)
                        .map((observation) => (
                          <div key={observation.id} className='bg-muted/40 rounded-lg p-4'>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                              <div>
                                <p className='font-medium'>{observation.description}</p>
                                <p className='text-muted-foreground mt-1 text-sm'>
                                  {[observation.counterparty, observation.occurred_at_text]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              </div>
                              <span className='font-semibold tabular-nums'>
                                {observation.amount === null
                                  ? t('amountUnknown')
                                  : `${observation.currency ?? ''} ${observation.amount.toLocaleString()}`}
                              </span>
                            </div>
                            {observation.source_excerpt && (
                              <p className='text-muted-foreground mt-3 border-l-2 pl-3 text-xs'>
                                {observation.source_excerpt}
                              </p>
                            )}
                            <p className='text-muted-foreground mt-2 text-xs'>
                              {t('confidence', {
                                percent: Math.round(observation.confidence * 100),
                              })}{' '}
                              · {t(`observationStatus.${observation.status}`)}
                            </p>
                            <SuggestionPanel
                              group={suggestions[document.id]?.find(
                                (group) => group.observation_id === observation.id,
                              )}
                            />
                          </div>
                        ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
