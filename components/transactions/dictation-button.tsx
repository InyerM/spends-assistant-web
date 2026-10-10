'use client';
import { Mic, Square } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useDictation } from '@/hooks/use-dictation';
export function DictationButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.ReactElement | null {
  const locale = useLocale();
  const t = useTranslations('dictation');
  const dictation = useDictation(
    locale === 'es' ? 'es-CO' : locale === 'pt' ? 'pt-BR' : 'en-US',
    (text) => onChange([value.trim(), text].filter(Boolean).join(' ')),
  );
  if (!dictation.supported) return null;
  return (
    <div className='space-y-2'>
      <Button
        type='button'
        variant='outline'
        onClick={dictation.listening ? dictation.stop : dictation.start}>
        {dictation.listening ? <Square className='mr-2 size-4' /> : <Mic className='mr-2 size-4' />}
        {dictation.listening ? t('stop') : t('start')}
      </Button>
      <p className='text-muted-foreground text-xs'>
        {dictation.failed ? t('failed') : dictation.listening ? t('listening') : t('hint')}
      </p>
    </div>
  );
}
