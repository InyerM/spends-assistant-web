'use client';
import { useEffect } from 'react';
import { Mic, Square, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent className='max-w-xs'>{t('liveHint')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {(voice.recording || voice.pending) && (
        <span
          role='status'
          aria-atomic='true'
          className='text-muted-foreground self-center text-xs'>
          {t(voice.recording ? 'liveListening' : voice.pending ? 'finalizing' : 'ready')}
        </span>
      )}
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
