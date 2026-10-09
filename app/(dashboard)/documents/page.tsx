'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { FileImage, MailPlus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import { Card, CardContent } from '@/components/ui/card';
import { DocumentCaptureCard } from '@/components/documents/document-capture-card';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { MAX_DOCUMENT_BYTES } from '@/lib/documents';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import {
  extractDocument,
  restoreDocumentObservation,
  setDocumentArchived,
  uploadDocument,
} from '@/lib/api/mutations/document.mutations';
import {
  documentKeys,
  fetchDocumentSuggestions,
  useDocuments,
  type DocumentSuggestionGroup,
} from '@/lib/api/queries/document.queries';
type SuggestionGroup = DocumentSuggestionGroup;

export default function DocumentsPage(): React.ReactElement {
  const t = useTranslations('documents');
  const queryClient = useQueryClient();
  const documentQuery = useDocuments();
  const refetchDocuments = documentQuery.refetch;
  const documents = documentQuery.data ?? [];
  const loading = documentQuery.isPending;
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | AiConsentRequiredError | null>(null);
  const [suggestions, setSuggestions] = useState<Partial<Record<string, SuggestionGroup[]>>>({});
  const [suggestionBusy, setSuggestionBusy] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const result = await refetchDocuments();
    if (result.error) throw result.error;
    setError(null);
  }, [refetchDocuments]);

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
      await uploadDocument(file);
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
      await extractDocument(id);
      await load();
    } catch (cause) {
      setError(
        cause instanceof AiConsentRequiredError
          ? cause
          : cause instanceof Error
            ? cause.message
            : t('extractFailed'),
      );
    } finally {
      setBusy(null);
    }
  };

  const findSuggestions = async (id: string): Promise<void> => {
    setSuggestionBusy(id);
    setError(null);
    try {
      const result = await queryClient.fetchQuery({
        queryKey: documentKeys.suggestions(id),
        queryFn: () => fetchDocumentSuggestions(id),
        staleTime: 0,
      });
      setSuggestions((current) => ({ ...current, [id]: result }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('suggestionsFailed'));
    } finally {
      setSuggestionBusy(null);
    }
  };

  const archiveCapture = async (id: string, archived: boolean): Promise<void> => {
    setBusy(id);
    try {
      await setDocumentArchived(id, archived);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('loadFailed'));
    } finally {
      setBusy(null);
    }
  };

  const restoreObservation = async (documentId: string, observationId: string): Promise<void> => {
    setBusy(observationId);
    try {
      await restoreDocumentObservation(documentId, observationId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('decisionFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className='mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <header className='flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between'>
        <div>
          <h2 className='text-foreground text-2xl font-semibold'>{t('title')}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>{t('subtitle')}</p>
        </div>
        <div className='flex flex-wrap items-center gap-2 [&>[data-slot=button]]:min-h-11'>
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
          <Button variant='ai' disabled={busy !== null} onClick={() => inputRef.current?.click()}>
            {busy === 'upload' ? (
              <InlineLoader className='mr-2' />
            ) : (
              <Upload className='mr-2 h-4 w-4' />
            )}
            {busy === 'upload' ? t('uploading') : t('upload')}
          </Button>
          <Button variant='outline' asChild>
            <Link href='/settings?tab=email-forwarding'>
              <MailPlus className='size-4' aria-hidden='true' />
              {t('connectEmail')}
            </Link>
          </Button>
          <Button variant='outline' onClick={() => setShowArchived((current) => !current)}>
            {showArchived
              ? t('activeCaptures')
              : `${t('archivedCaptures')} · ${documents.filter((document) => !!document.archived_at).length}`}
          </Button>
        </div>
      </header>

      {error instanceof AiConsentRequiredError && <AiConsentNotice scope={error.scope} />}
      {(typeof error === 'string' || documentQuery.error) && (
        <p
          role='alert'
          className='text-destructive rounded-lg border border-current/20 p-3 text-sm'>
          {typeof error === 'string' ? error : documentQuery.error?.message}
        </p>
      )}
      {loading ? (
        <p className='text-muted-foreground text-sm'>{t('loading')}</p>
      ) : documents.filter((document) => Boolean(document.archived_at) === showArchived).length ===
        0 ? (
        <Card>
          <CardContent className='flex flex-col items-center py-12 text-center'>
            <FileImage className='text-muted-foreground mb-3 h-10 w-10' />
            <p className='font-medium'>{t('empty')}</p>
            <p className='text-muted-foreground mt-1 text-sm'>{t('emptyHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {documents
            .filter((document) => Boolean(document.archived_at) === showArchived)
            .map((document) => (
              <DocumentCaptureCard
                key={document.id}
                document={document}
                history={documents.flatMap((entry) =>
                  entry.document_observations.map((observation) => ({
                    ...observation,
                    document_type: entry.document_type,
                  })),
                )}
                accounts={accounts ?? []}
                categories={categories ?? []}
                suggestions={suggestions[document.id]}
                busy={busy}
                suggestionsBusy={suggestionBusy === document.id}
                onOpen={() => void findSuggestions(document.id)}
                onArchive={(archived) => void archiveCapture(document.id, archived)}
                onExtract={() => void extract(document.id)}
                onRestore={(documentId, observationId) =>
                  void restoreObservation(documentId, observationId)
                }
                onRefresh={load}
              />
            ))}
        </div>
      )}
    </div>
  );
}
