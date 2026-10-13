'use client';
import { useEffect } from 'react';
import { Mic, Square, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useVoiceDraft } from '@/hooks/use-voice-draft';
export function DictationButton({
  value,
  onChange,
  onBusyChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onBusyChange?: (busy: boolean) => void;
}): React.ReactElement {
  const t = useTranslations('dictation'),
    voice = useVoiceDraft(value, onChange);
  const busy = voice.acquiring || voice.recording || voice.pending;
  useEffect(() => {
    onBusyChange?.(busy);
    return (): void => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  return (
    <div className='contents'>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        aria-pressed={voice.recording}
        disabled={voice.acquiring || (!voice.recording && voice.pending)}
        className={voice.recording ? 'text-brand bg-brand/10 min-h-11' : 'min-h-11'}
        onClick={
          voice.recording
            ? voice.finish
            : (): void => {
                void voice.start();
              }
        }>
        {voice.acquiring || (!voice.recording && voice.pending) ? (
          <LoaderCircle
            className='size-4 animate-spin motion-reduce:animate-none'
            aria-hidden='true'
          />
        ) : voice.recording ? (
          <Square className='size-4' aria-hidden='true' />
        ) : (
          <Mic className='size-4' aria-hidden='true' />
        )}
        {t(
          voice.acquiring
            ? 'connecting'
            : voice.recording
              ? 'stop'
              : voice.pending
                ? 'transcribing'
                : 'start',
        )}
      </Button>
      {(voice.recording || voice.pending || voice.completed) && (
        <span
          role='status'
          aria-atomic='true'
          className='text-muted-foreground self-center text-xs'>
          {t(voice.recording ? 'liveListening' : voice.pending ? 'finalizing' : 'ready')}
        </span>
      )}
      <p className='text-muted-foreground basis-full text-xs'>{t('liveHint')}</p>
      {voice.error && (
        <p role='alert' className='text-warning basis-full text-xs'>
          {t(
            voice.error === 'consent'
              ? 'consent'
              : voice.error === 'quota'
                ? 'quota'
                : voice.error === 'empty'
                  ? 'noSpeech'
                  : 'failed',
          )}
        </p>
      )}
      {voice.completed && voice.relevance && voice.relevance !== 'financial' && (
        <p role='status' className='text-warning basis-full text-xs'>
          {t(voice.relevance === 'unrelated' ? 'unrelated' : 'unclear')}
        </p>
      )}
    </div>
  );
}
