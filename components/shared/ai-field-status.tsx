'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AiFieldStatus({
  state = 'suggested',
}: {
  state?: 'analyzing' | 'suggested';
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  return (
    <span className='ai-field-status'>
      <Sparkles className='size-3 shrink-0' aria-hidden='true' />
      {t(state === 'analyzing' ? 'fieldAnalyzing' : 'fieldSuggested')}
    </span>
  );
}
