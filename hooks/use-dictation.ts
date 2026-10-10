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
  onerror: (() => void) | null;
  onend: (() => void) | null;
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
  start: () => void;
  stop: () => void;
} {
  const [listening, setListening] = useState(false);
  const [failed, setFailed] = useState(false);
  const supported = useSyncExternalStore(
    () => (): void => {},
    (): boolean => {
      const host = window as SpeechWindow;
      return Boolean(host.SpeechRecognition ?? host.webkitSpeechRecognition);
    },
    (): boolean => false,
  );
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect((): void => {
    callback.current = onText;
  }, [onText]);
  useEffect(() => {
    return (): void => {
      if (recognition.current) {
        recognition.current.onend = null;
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.stop();
      }
    };
  }, []);
  const stop = useCallback(() => {
    recognition.current?.stop();
    setListening(false);
  }, []);
  const start = useCallback(() => {
    const host = window as SpeechWindow;
    const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
    if (!Constructor) return;
    recognition.current?.stop();
    const next = new Constructor();
    next.lang = language;
    next.continuous = false;
    next.interimResults = false;
    next.onresult = (event): void => {
      const text = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      if (text) callback.current(text);
    };
    next.onerror = (): void => {
      setFailed(true);
      setListening(false);
    };
    next.onend = (): void => setListening(false);
    recognition.current = next;
    setFailed(false);
    try {
      next.start();
      setListening(true);
    } catch {
      setFailed(true);
      setListening(false);
    }
  }, [language]);
  return { supported, listening, failed, start, stop };
}
