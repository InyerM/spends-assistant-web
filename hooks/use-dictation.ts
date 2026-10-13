'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
        resultIndex: number;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechend?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useDictation(
  language: string,
  onText: (text: string) => void,
): {
  supported: boolean;
  listening: boolean;
  failed: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
} {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = useSyncExternalStore(
    () => (): void => {},
    (): boolean => {
      const host = window as SpeechWindow;
      return Boolean(host.SpeechRecognition ?? host.webkitSpeechRecognition);
    },
    (): boolean => false,
  );
  const recognition = useRef<Recognition | null>(null);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onText);
  useEffect((): void => {
    callback.current = onText;
  }, [onText]);
  useEffect(() => {
    return (): void => {
      if (silence.current) clearTimeout(silence.current);
      if (recognition.current) {
        recognition.current.onspeechend = null;
        recognition.current.onspeechstart = null;
        recognition.current.onend = null;
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.stop();
      }
    };
  }, []);
  const stop = useCallback(() => {
    if (silence.current) clearTimeout(silence.current);
    recognition.current?.stop();
    setListening(false);
  }, []);
  const start = useCallback(() => {
    const host = window as SpeechWindow;
    const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Constructor) return;
    if (silence.current) clearTimeout(silence.current);
    if (recognition.current) {
      recognition.current.onspeechend = null;
      recognition.current.onspeechstart = null;
      recognition.current.onend = null;
      recognition.current.onerror = null;
      recognition.current.onresult = null;
      recognition.current.stop();
    }
    const next = new Constructor();
    next.lang = language;
    next.continuous = true;
    next.interimResults = true;
    next.onresult = (event): void => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      if (text) callback.current(text);
    };
    next.onspeechstart = (): void => {
      if (silence.current) clearTimeout(silence.current);
    };
    next.onspeechend = (): void => {
      if (silence.current) clearTimeout(silence.current);
      silence.current = setTimeout(stop, 1800);
    };
    next.onerror = (event): void => {
      if (event.error !== 'aborted') setError(event.error);
      setListening(false);
    };
    next.onend = (): void => setListening(false);
    recognition.current = next;
    setError(null);
    try {
      next.start();
      setListening(true);
    } catch {
      setError('start-failed');
      setListening(false);
    }
  }, [language, stop]);
  return { supported, listening, failed: error !== null, error, start, stop };
}
