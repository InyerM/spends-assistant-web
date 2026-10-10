'use client';
import { useEffect, useRef, useState } from 'react';
export function useAudioRecording(
  onAudio: (input: { data: string; format: string }) => Promise<void>,
): {
  recording: boolean;
  error: string | null;
  start: () => Promise<void>;
  finish: () => void;
  cancel: () => void;
} {
  const [recording, setRecording] = useState(false),
    [error, setError] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    generation = useRef(0),
    callback = useRef(onAudio);
  useEffect(() => {
    callback.current = onAudio;
  }, [onAudio]);
  function release(): void {
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  function cancel(): void {
    generation.current++;
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.ondataavailable = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    release();
    setRecording(false);
  }
  useEffect(
    () => (): void => {
      generation.current++;
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.ondataavailable = null;
        if (recorder.current.state !== 'inactive') recorder.current.stop();
      }
      if (timer.current) clearTimeout(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  async function start(): Promise<void> {
    cancel();
    setError(null);
    const id = generation.current;
    try {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== generation.current) {
        captured.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = captured;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime) throw new Error('unsupported');
      const next = new MediaRecorder(captured, { mimeType: mime, audioBitsPerSecond: 64000 });
      recorder.current = next;
      const chunks: Blob[] = [];
      let bytes = 0;
      next.ondataavailable = (event): void => {
        bytes += event.data.size;
        if (bytes > 2000000) {
          cancel();
          setError('size');
          return;
        }
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = (): void => {
        release();
        setRecording(false);
        if (id !== generation.current) return;
        const blob = new Blob(chunks, { type: mime });
        if (!blob.size) {
          setError('empty');
          return;
        }
        const reader = new FileReader();
        reader.onload = (): void => {
          if (id !== generation.current) return;
          if (typeof reader.result !== 'string') return;
          const data = reader.result.split(',')[1];
          void callback
            .current({
              data,
              format: mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm',
            })
            .catch(() => {
              if (id === generation.current) setError('service');
            });
        };
        reader.readAsDataURL(blob);
      };
      next.onerror = (): void => {
        cancel();
        setError('microphone');
      };
      next.start(1000);
      setRecording(true);
      timer.current = setTimeout(() => {
        next.stop();
      }, 30000);
    } catch {
      release();
      setRecording(false);
      setError('microphone');
    }
  }
  function finish(): void {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }
  return { recording, error, start, finish, cancel };
}
