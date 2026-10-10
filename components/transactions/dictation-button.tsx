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
  const key =
    dictation.error === 'not-allowed'
      ? 'permission'
      : dictation.error === 'audio-capture'
        ? 'microphone'
        : dictation.error === 'no-speech'
          ? 'noSpeech'
          : dictation.error === 'language-not-supported'
            ? 'language'
            : dictation.error === 'network' || dictation.error === 'service-not-allowed'
              ? 'service'
              : 'failed';
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        aria-pressed={dictation.listening}
        className={dictation.listening ? 'text-brand bg-brand/10' : ''}
        onClick={dictation.listening ? dictation.stop : dictation.start}>
        {dictation.listening ? (
          <Square className='size-4' aria-hidden='true' />
        ) : (
          <Mic className='size-4' aria-hidden='true' />
        )}
        {t(dictation.listening ? 'stop' : 'start')}
      </Button>
      {dictation.listening && (
        <span role='status' className='text-brand text-xs'>
          {t('listening')}
        </span>
      )}
      {dictation.failed && (
        <p role='alert' className='text-warning basis-full text-xs leading-5'>
          {t(key)}
        </p>
      )}
    </div>
  );
}
