'use client';
import { Mic, Square, AudioLines, LoaderCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAudioRecording } from '@/hooks/use-audio-recording';
import { useTranscribeAudio } from '@/lib/api/mutations/audio.mutations';
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
  const transcription = useTranscribeAudio();
  const audio = useAudioRecording(async (input) => {
    const text = await transcription.mutateAsync({ ...input, language: locale });
    if (text) onChange([value.trim(), text].filter(Boolean).join(' '));
  });
  const fallback =
    !dictation.supported ||
    dictation.error === 'network' ||
    dictation.error === 'service-not-allowed';
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
      {dictation.supported && !fallback && (
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
      )}
      {fallback && (
        <div className='space-y-1'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={transcription.isPending}
            onClick={
              audio.recording
                ? audio.finish
                : (): void => {
                    void audio.start();
                  }
            }>
            {transcription.isPending ? (
              <LoaderCircle className='size-4 animate-spin' />
            ) : audio.recording ? (
              <Square className='size-4' />
            ) : (
              <AudioLines className='size-4' />
            )}
            {t(
              transcription.isPending ? 'transcribing' : audio.recording ? 'transcribe' : 'record',
            )}
          </Button>
          <p className='text-muted-foreground max-w-prose text-xs'>{t('audioHint')}</p>
        </div>
      )}
      {(audio.error || transcription.error) && (
        <p role='alert' className='text-warning basis-full text-xs'>
          {t(
            transcription.error?.message === 'consent'
              ? 'consent'
              : transcription.error?.message === 'quota'
                ? 'quota'
                : 'failed',
          )}
        </p>
      )}
      {dictation.listening && (
        <span role='status' className='text-brand text-xs'>
          {t('listening')}
        </span>
      )}
      {dictation.failed && !fallback && (
        <p role='alert' className='text-warning basis-full text-xs leading-5'>
          {t(key)}
        </p>
      )}
    </div>
  );
}
