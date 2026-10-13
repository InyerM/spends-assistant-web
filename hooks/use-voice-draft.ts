'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useDictation } from '@/hooks/use-dictation';
import { useAudioRecording } from '@/hooks/use-audio-recording';
import { useTranscribeAudio } from '@/lib/api/mutations/audio.mutations';
export function useVoiceDraft(
  value: string,
  onChange: (value: string) => void,
): {
  start: () => Promise<void>;
  finish: () => void;
  recording: boolean;
  acquiring: boolean;
  pending: boolean;
  error: string | null;
  relevance: 'financial' | 'unrelated' | 'unclear' | null;
  completed: boolean;
} {
  const locale = useLocale(),
    transcription = useTranscribeAudio();
  const [relevance, setRelevance] = useState<'financial' | 'unrelated' | 'unclear' | null>(null);
  const [completed, setCompleted] = useState(false);
  const [reviewedText, setReviewedText] = useState<string | null>(null);
  const current = useRef(value),
    change = useRef(onChange),
    base = useRef(''),
    written = useRef(''),
    session = useRef(''),
    sequence = useRef(0),
    nativeActive = useRef(false);
  useEffect(() => {
    current.current = value;
    change.current = onChange;
  }, [value, onChange]);
  useEffect(
    () => (): void => {
      session.current = '';
    },
    [],
  );
  const apply = (text: string): void => {
    if (current.current !== written.current) return;
    const next = [base.current, text].filter(Boolean).join(' ');
    written.current = next;
    current.current = next;
    change.current(next);
  };
  const native = useDictation(
    locale === 'es' ? 'es-CO' : locale === 'pt' ? 'pt-BR' : 'en-US',
    (text) => {
      if (session.current) apply(text);
    },
  );
  useEffect(() => {
    nativeActive.current = native.listening && !native.error;
  }, [native.listening, native.error]);
  const audio = useAudioRecording(async (input, final) => {
    if (!final && nativeActive.current) return;
    const id = session.current;
    if (!id) return;
    if (final) native.stop();
    const result = await transcription.mutateAsync({
      ...input,
      language: locale,
      session_id: id,
      sequence: sequence.current++,
      final,
    });
    if (session.current !== id) return;
    if (result.text) apply(result.text);
    if (final) {
      setReviewedText(current.current === written.current ? current.current : null);
      setRelevance(result.relevance);
      setCompleted(true);
      session.current = '';
    }
  });
  const stopNative = native.stop;
  useEffect(() => {
    if (audio.error) {
      stopNative();
      session.current = '';
    }
  }, [audio.error, stopNative]);
  async function start(): Promise<void> {
    native.stop();
    setRelevance(null);
    setCompleted(false);
    setReviewedText(null);
    transcription.reset();
    base.current = value.trim();
    written.current = value;
    current.current = value;
    session.current = crypto.randomUUID();
    sequence.current = 0;
    const started = await audio.start();
    if (started && session.current && native.supported) native.start();
  }
  function finish(): void {
    native.stop();
    audio.finish();
  }
  return {
    start,
    finish,
    recording: audio.recording,
    acquiring: audio.acquiring,
    pending: transcription.isPending,
    error: transcription.error?.message ?? audio.error,
    relevance: value === reviewedText ? relevance : null,
    completed,
  };
}
