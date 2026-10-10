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
