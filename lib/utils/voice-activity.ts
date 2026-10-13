import { encodeVoiceWav } from '@/lib/utils/voice-wav';
export function createVoiceActivity(
  start: number,
): (now: number, rms: number) => 'listening' | 'silence' | 'empty' {
  let heard = false,
    consecutive = 0,
    lastVoice = start;
  return (now, rms) => {
    if (rms > 0.018) {
      consecutive++;
      if (consecutive >= 3) heard = true;
      lastVoice = now;
    } else consecutive = 0;
    if (heard && now - lastVoice >= 1800) return 'silence';
    if (!heard && now - start >= 6000) return 'empty';
    return 'listening';
  };
}
export function watchVoiceActivity(
  stream: MediaStream,
  finish: (empty: boolean) => void,
): {
  release: () => void;
  snapshot: () => Blob | null;
  ready: Promise<void>;
  hasSpeech: () => boolean;
} {
  if (typeof AudioContext === 'undefined')
    return {
      release: (): void => {},
      snapshot: (): Blob | null => null,
      ready: Promise.resolve(),
      hasSpeech: (): boolean => false,
    };
  const context = new AudioContext(),
    source = context.createMediaStreamSource(stream),
    analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  void context.resume().catch(() => {});
  const chunks: Float32Array[] = [];
  let capture: AudioWorkletNode | null = null,
    disposed = false;
  const gain = context.createGain();
  gain.gain.value = 0;
  const ready =
    typeof AudioWorkletNode !== 'undefined'
      ? context.audioWorklet
          .addModule('/audio-worklet')
          .then(() => {
            if (disposed) return;
            capture = new AudioWorkletNode(context, 'anotto-voice-capture');
            capture.port.onmessage = (event: MessageEvent<Float32Array>): void => {
              if (!disposed && event.data instanceof Float32Array) chunks.push(event.data);
            };
            source.connect(capture);
            capture.connect(gain);
            gain.connect(context.destination);
          })
          .catch(() => {})
      : Promise.resolve();
  let voiced = false,
    speechFrames = 0;
  const samples = new Uint8Array(analyser.fftSize),
    detect = createVoiceActivity(Date.now());
  const timer = setInterval(() => {
    if (context.state !== 'running') return;
    analyser.getByteTimeDomainData(samples);
    const rms = Math.sqrt(
      samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length,
    );
    speechFrames = rms > 0.018 ? speechFrames + 1 : 0;
    if (speechFrames >= 3) voiced = true;
    const state = detect(Date.now(), rms);
    if (state !== 'listening') {
      clearInterval(timer);
      finish(state === 'empty');
    }
  }, 100);
  return {
    ready,
    hasSpeech: (): boolean => voiced,
    snapshot: (): Blob | null =>
      chunks.length
        ? new Blob([encodeVoiceWav(chunks, context.sampleRate)], { type: 'audio/wav' })
        : null,
    release: (): void => {
      disposed = true;
      clearInterval(timer);
      source.disconnect();
      capture?.disconnect();
      gain.disconnect();
      if (capture) capture.port.onmessage = null;
      chunks.length = 0;
      void context.close().catch(() => {});
    },
  };
}
