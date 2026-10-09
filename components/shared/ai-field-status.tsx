'use client';

import { Check, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AiFieldStatus({
  state = 'suggested',
}: {
  state?: 'analyzing' | 'suggested';
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  return (
    <span className='ai-field-status' data-ai-state={state}>
      {state === 'analyzing' ? (
        <LoaderCircle className='size-3 shrink-0 motion-safe:animate-spin' aria-hidden='true' />
      ) : (
        <Check className='size-3 shrink-0' aria-hidden='true' />
      )}
      {t(state === 'analyzing' ? 'fieldAnalyzing' : 'fieldSuggested')}
    </span>
  );
}
