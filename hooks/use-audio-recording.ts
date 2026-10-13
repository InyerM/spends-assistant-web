'use client';
import { useEffect, useRef, useState } from 'react';
import { watchVoiceActivity } from '@/lib/utils/voice-activity';
export function useAudioRecording(
  onAudio: (input: { data: string; format: string }, final: boolean) => Promise<void>,
): {
  recording: boolean;
  acquiring: boolean;
  error: string | null;
  start: () => Promise<boolean>;
  finish: () => void;
  cancel: () => void;
} {
  const [acquiring, setAcquiring] = useState(false);
  const activity = useRef<ReturnType<typeof watchVoiceActivity> | null>(null);
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
    activity.current?.release();
    activity.current = null;
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
    setAcquiring(false);
  }
  useEffect(
    () => (): void => {
      generation.current++;
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.ondataavailable = null;
        if (recorder.current.state !== 'inactive') recorder.current.stop();
      }
      activity.current?.release();
      if (timer.current) clearTimeout(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  async function start(): Promise<boolean> {
    cancel();
    setError(null);
    setAcquiring(true);
    const id = generation.current;
    try {
      const captured = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (id !== generation.current) {
        captured.getTracks().forEach((track) => track.stop());
        return false;
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
      let pending = Promise.resolve(),
        previews = 0,
        lastPreview = Date.now(),
        empty = false;
      const deliver = (final: boolean, captured: Blob | null = null): void => {
        const pcm = captured ?? activity.current?.snapshot();
        if (!final && (!pcm || !activity.current?.hasSpeech())) return;
        const blob = pcm ?? new Blob(chunks, { type: mime });
        if (!blob.size || empty) {
          if (final) setError('empty');
          return;
        }
        pending = pending
          .then(async () => {
            if (id !== generation.current) return;
            const data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (): void =>
                typeof reader.result === 'string'
                  ? resolve(reader.result.split(',')[1])
                  : reject(new Error('Invalid audio'));
              reader.onerror = (): void => reject(new Error('Unreadable audio'));
              reader.readAsDataURL(blob);
            });
            if (id !== generation.current) return;
            await callback.current(
              {
                data,
                format: pcm
                  ? 'wav'
                  : mime.includes('mp4')
                    ? 'm4a'
                    : mime.includes('ogg')
                      ? 'ogg'
                      : 'webm',
              },
              final,
            );
          })
          .catch(() => {
            if (id === generation.current) {
              cancel();
              setError('service');
            }
          });
      };
      next.ondataavailable = (event): void => {
        bytes += event.data.size;
        if (bytes > 2000000) {
          cancel();
          setError('size');
          return;
        }
        if (event.data.size) chunks.push(event.data);
        if (next.state === 'recording' && previews < 3 && Date.now() - lastPreview >= 4000) {
          previews++;
          lastPreview = Date.now();
          deliver(false);
        }
      };
      next.onstop = (): void => {
        const finalAudio = activity.current?.snapshot() ?? null;
        release();
        setRecording(false);
        if (id === generation.current) deliver(true, finalAudio);
      };
      next.onerror = (): void => {
        cancel();
        setError('microphone');
      };
      const monitor = watchVoiceActivity(captured, (noSpeech) => {
        empty = noSpeech;
        if (next.state === 'recording') next.stop();
      });
      activity.current = monitor;
      await monitor.ready;
      if (id !== generation.current) {
        monitor.release();
        captured.getTracks().forEach((track) => track.stop());
        return false;
      }
      next.start(1000);
      setRecording(true);
      setAcquiring(false);
      timer.current = setTimeout(() => {
        next.stop();
      }, 60000);
      return true;
    } catch {
      release();
      setRecording(false);
      setAcquiring(false);
      setError('microphone');
      return false;
    }
  }
  function finish(): void {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }
  return { recording, acquiring, error, start, finish, cancel };
}
