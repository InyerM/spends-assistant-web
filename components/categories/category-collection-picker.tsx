'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { CategoryCollection } from '@/lib/categories/collections';
export function CategoryCollectionPicker({
  value,
  onChange,
  searching,
  unavailable,
  onRetry,
  starter,
}: {
  value: CategoryCollection;
  onChange: (value: CategoryCollection) => void;
  searching: boolean;
  unavailable: boolean;
  onRetry: () => void;
  starter: boolean;
}): React.ReactElement {
  const t = useTranslations('categories');
  return (
    <div className='space-y-2'>
      <div role='group' aria-label={t('collectionLabel')} className='flex flex-wrap gap-2'>
        {(['usual', 'more'] as const).map((collection) => (
          <Button
            key={collection}
            variant='outline'
            aria-pressed={value === collection}
            disabled={searching || unavailable}
            className={
              value === collection && !searching
                ? 'border-success bg-success/10 text-success dark:border-success dark:text-success'
                : ''
            }
            onClick={() => onChange(collection)}>
            {t(collection === 'usual' ? 'usualCategories' : 'moreCategories')}
          </Button>
        ))}
      </div>
      <p className='text-muted-foreground text-xs'>
        {t(
          unavailable
            ? 'usageUnavailable'
            : searching
              ? 'searchAllCategories'
              : starter
                ? 'starterHint'
                : 'collectionHint',
        )}
      </p>
      {unavailable && (
        <Button size='sm' variant='ghost' onClick={onRetry}>
          {t('retryUsage')}
        </Button>
      )}
    </div>
  );
}
