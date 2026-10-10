import { renderHook, act } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { useDictation } from '@/hooks/use-dictation';
it('adds dictated text to a draft without submitting it and stops on unmount', () => {
  let instance:
    | { onresult: ((event: unknown) => void) | null; stop: ReturnType<typeof vi.fn> }
    | undefined;
  class Speech {
    onresult = null;
    onerror = null;
    onend = null;
    lang = '';
    continuous = false;
    interimResults = false;
    stop = vi.fn();
    start = vi.fn();
    constructor() {
      // The fake exposes the browser-owned recognition instance.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      instance = this;
    }
  }
  Object.defineProperty(window, 'SpeechRecognition', { value: Speech, configurable: true });
  const onText = vi.fn();
  const hook = renderHook(() => useDictation('es-CO', onText));
  act(() => hook.result.current.start());
  act(() =>
    instance?.onresult?.({
      results: [[{ transcript: 'transferí 50000 a mi cuenta Lulo' }]],
      resultIndex: 0,
    }),
  );
  expect(onText).toHaveBeenCalledWith('transferí 50000 a mi cuenta Lulo');
  hook.unmount();
  expect(instance?.stop).toHaveBeenCalled();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
});
it('reports service failures separately from microphone permission and ignores intentional aborts', () => {
  let instance: { onerror: ((event: { error: string }) => void) | null } | undefined;
  class Speech {
    onresult = null;
    onerror = null;
    onend = null;
    lang = '';
    continuous = false;
    interimResults = false;
    start = vi.fn();
    stop = vi.fn();
    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      instance = this;
    }
  }
  Object.defineProperty(window, 'SpeechRecognition', { value: Speech, configurable: true });
  const hook = renderHook(() => useDictation('es-CO', vi.fn()));
  act(() => hook.result.current.start());
  act(() => instance?.onerror?.({ error: 'network' }));
  expect(hook.result.current.error).toBe('network');
  act(() => hook.result.current.start());
  act(() => instance?.onerror?.({ error: 'aborted' }));
  expect(hook.result.current.failed).toBe(false);
  hook.unmount();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
});
