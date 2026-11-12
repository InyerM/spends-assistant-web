'use client';

import { useTranslations } from 'next-intl';

export function DocumentOcrProvenance({
  rows,
}: {
  rows: { id: string; source_page?: number | null; description: string; source_excerpt: string }[];
}): React.ReactElement | null {
  const t = useTranslations('documents');
  const sourced = rows.filter((row) => row.source_page !== null && row.source_page !== undefined);
  if (sourced.length === 0) return null;
  return (
    <details className='border-border space-y-2 rounded-lg border p-3 text-sm'>
      <summary className='cursor-pointer font-medium'>{t('ocrProvenance')}</summary>
      <p className='text-muted-foreground my-3'>{t('ocrReviewRequired')}</p>
      <ul className='space-y-3'>
        {sourced.map((row) => (
          <li key={row.id} className='border-border border-t pt-2'>
            <p className='font-medium'>
              {t('sourcePage', { page: row.source_page! })} · {row.description}
            </p>
            <p className='text-muted-foreground break-words'>{row.source_excerpt}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
