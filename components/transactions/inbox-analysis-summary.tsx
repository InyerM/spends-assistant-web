'use client';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { useCategories } from '@/lib/api/queries/category.queries';
import type { InboxAnalysis, InboxAnalysisJob } from '@/types/shortcut-inbox';

function SuggestedCategory({ id }: { id: string }): React.ReactElement | null {
  const t = useTranslations('shortcutInbox');
  const categories = useCategories();
  const category = Array.isArray(categories.data)
    ? categories.data.find((row) => row.id === id && row.is_active)
    : undefined;
  return category ? (
    <p className='text-muted-foreground text-xs'>
      {t('preparedCategory', { category: category.name })}
    </p>
  ) : null;
}

export function InboxAnalysisSummary({
  analysis,
  job,
}: {
  analysis?: InboxAnalysis;
  job?: InboxAnalysisJob;
}): React.ReactElement | null {
  const t = useTranslations('shortcutInbox');
  const preparing = job?.state === 'pending' || job?.state === 'running';
  if (!analysis && !job) return null;
  return (
    <div className='space-y-1' aria-live='polite'>
      <Badge variant='outline'>
        {t(preparing ? 'preparedPending' : analysis ? 'preparedReady' : 'preparedUnavailable')}
      </Badge>
      {analysis?.description && <p className='text-sm font-medium'>{analysis.description}</p>}
      {analysis?.explanation && (
        <p className='text-muted-foreground text-xs'>{analysis.explanation}</p>
      )}
      {analysis?.category_id && <SuggestedCategory id={analysis.category_id} />}
      <p className='text-muted-foreground text-xs'>{t('preparedReviewOnly')}</p>
    </div>
  );
}
