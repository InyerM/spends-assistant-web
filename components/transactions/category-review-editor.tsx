'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import {
  useSaveCategoryReview,
  useExplainCategoryReview,
} from '@/lib/api/mutations/category-review.mutations';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import type { CategoryFollowup } from '@/lib/api/queries/category-followup.queries';
import { CategoryReviewRow, type ReviewDraft } from './category-review-row';
import type { Category } from '@/types';
export function CategoryReviewEditor({
  sourceId,
  data,
  categories,
  onComplete,
}: {
  sourceId: string;
  data: CategoryFollowup;
  categories: Category[];
  onComplete: () => void;
}): React.ReactElement {
  const t = useTranslations('categoryFollowup'),
    locale = useLocale();
  const save = useSaveCategoryReview(sourceId),
    explain = useExplainCategoryReview(sourceId);
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft | undefined>>({});
  const type = data.source?.type ?? 'expense';
  return (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>{t('historyBasis')}</p>
      <details className='text-sm'>
        <summary className='cursor-pointer font-medium'>
          {t('basisTitle', { count: data.evidence?.length ?? 1 })}
        </summary>
        <div className='mt-3 space-y-3'>
          {(data.evidence ?? []).map((item) => (
            <div key={item.id} className='border-border border-b pb-2'>
              <Link href={`/transactions/${item.id}`} className='text-success text-sm underline'>
                {item.description}
              </Link>
              <p className='text-muted-foreground mt-1 text-xs'>{item.category_name}</p>
              {item.notes && (
                <p className='text-muted-foreground mt-1 text-xs whitespace-pre-wrap'>
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </details>
      <Button
        size='sm'
        variant='ai'
        disabled={explain.isPending || save.isPending}
        onClick={() => explain.mutate({ locale })}>
        <Sparkles className='size-4' />
        {t(explain.isPending ? 'analyzingContext' : 'explainWithAi')}
      </Button>
      {explain.data && (
        <div className='bg-muted/40 space-y-2 rounded-lg p-3 text-sm'>
          <p>{explain.data.explanation}</p>
          <div className='flex flex-wrap gap-2'>
            {explain.data.evidence_ids.map((id) => {
              const source = data.evidence?.find((item) => item.id === id);
              return source ? (
                <Link
                  key={id}
                  className='text-success text-xs underline'
                  href={`/transactions/${id}`}>
                  {source.description}
                </Link>
              ) : null;
            })}
          </div>
        </div>
      )}
      {explain.error instanceof AiConsentRequiredError ? (
        <AiConsentNotice scope={explain.error.scope} />
      ) : (
        explain.error && (
          <p role='status' className='text-muted-foreground text-xs'>
            {t('explanationUnavailable')}
          </p>
        )
      )}
      {data.rows.map((row) => {
        const draft = drafts[row.id] ?? {
          category_id: data.category_id,
          description: row.description,
          notes: row.notes ?? null,
        };
        return (
          <CategoryReviewRow
            key={row.id}
            sourceId={sourceId}
            row={row}
            draft={draft}
            categories={categories}
            type={type}
            selected={selected.includes(row.id)}
            busy={save.isPending}
            onSelect={(checked) =>
              setSelected((ids) => (checked ? [...ids, row.id] : ids.filter((id) => id !== row.id)))
            }
            onChange={(value) => {
              setDrafts((current) => ({ ...current, [row.id]: value }));
              setSelected((ids) => (ids.includes(row.id) ? ids : [...ids, row.id]));
            }}
          />
        );
      })}
      <p className='text-muted-foreground text-xs'>{t('originalPreserved')}</p>
      {save.error && (
        <p role='alert' className='text-destructive text-sm'>
          {t('changed')}
        </p>
      )}
      <div className='bg-background sticky bottom-0 border-t pt-3'>
        <Button
          className='w-full'
          disabled={
            save.isPending ||
            !selected.length ||
            selected.some((id) => drafts[id] && !drafts[id].description.trim())
          }
          onClick={() =>
            save
              .mutateAsync({
                source_category_id: data.category_id,
                targets: data.rows
                  .filter((row) => selected.includes(row.id))
                  .map((row) => ({
                    id: row.id,
                    ...(drafts[row.id] ?? {
                      category_id: data.category_id,
                      description: row.description,
                      notes: row.notes ?? null,
                    }),
                    expected_category_id: row.category_id,
                    expected_description: row.description,
                    expected_notes: row.notes ?? null,
                  })),
              })
              .then(onComplete)
              .catch(() => undefined)
          }>
          {save.isPending && <InlineLoader />}
          {t('saveReviewed', { count: selected.length })}
        </Button>
      </div>
    </div>
  );
}
