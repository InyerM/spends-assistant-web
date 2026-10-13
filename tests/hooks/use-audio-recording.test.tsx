import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useAudioRecording } from '@/hooks/use-audio-recording';
it('stops microphone tracks on cancellation without submitting the recording', async () => {
  const stop = vi.fn(),
    transcribe = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
  });
  class Recorder {
    static isTypeSupported = () => true;
    state = 'inactive';
    ondataavailable = null;
    onstop: (() => void) | null = null;
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  const hook = renderHook(() => useAudioRecording(transcribe));
  await act(async () => hook.result.current.start());
  act(() => hook.result.current.cancel());
  expect(stop).toHaveBeenCalled();
  expect(transcribe).not.toHaveBeenCalled();
  hook.unmount();
  vi.unstubAllGlobals();
});

it('captures the first syllable before the activity monitor finishes loading', async () => {
  const started = vi.fn();
  let ready!: () => void;
  const monitorReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const monitor = await import('@/lib/utils/voice-activity');
  const watch = vi.spyOn(monitor, 'watchVoiceActivity').mockReturnValue({
    ready: monitorReady,
    release: vi.fn(),
    snapshot: () => null,
    hasSpeech: () => true,
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
  class Recorder {
    static isTypeSupported = () => true;
    state = 'inactive';
    onstop = null;
    ondataavailable = null;
    start() {
      this.state = 'recording';
      started();
    }
    stop() {
      this.state = 'inactive';
    }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  const hook = renderHook(() => useAudioRecording(vi.fn()));
  let starting!: Promise<boolean>;
  await act(async () => {
    starting = hook.result.current.start();
    await Promise.resolve();
  });
  expect(started).toHaveBeenCalled();
  ready();
  await act(async () => {
    await starting;
  });
  hook.unmount();
  watch.mockRestore();
  vi.unstubAllGlobals();
});
