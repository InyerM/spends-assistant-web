import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useVoiceDraft } from '@/hooks/use-voice-draft';
const mocks = vi.hoisted(() => ({
  nativeText: null as null | ((text: string) => void),
  audio: null as
    | null
    | ((input: { data: string; format: string }, final: boolean) => Promise<void>),
  mutate: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('next-intl', () => ({ useLocale: () => 'es' }));
vi.mock('@/hooks/use-dictation', () => ({
  useDictation: (_language: string, onText: (text: string) => void) => {
    mocks.nativeText = onText;
    return { supported: true, listening: false, error: null, start: mocks.start, stop: mocks.stop };
  },
}));
vi.mock('@/hooks/use-audio-recording', () => ({
  useAudioRecording: (callback: typeof mocks.audio) => {
    mocks.audio = callback;
    return {
      recording: false,
      acquiring: false,
      error: null,
      start: async () => true,
      finish: vi.fn(),
    };
  },
}));
vi.mock('@/lib/api/mutations/audio.mutations', () => ({
  useTranscribeAudio: () => ({
    mutateAsync: mocks.mutate,
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutate.mockResolvedValue({ text: 'pagué 20000', relevance: 'financial' });
});
const fixture = () =>
  renderHook(() => {
    const [value, setValue] = useState('Existing note');
    return { voice: useVoiceDraft(value, setValue), value, setValue };
  });
it('replaces provisional words instead of appending duplicates and bills updates within one session', async () => {
  const hook = fixture();
  await act(async () => hook.result.current.voice.start());
  act(() => mocks.nativeText?.('pagué veinte'));
  act(() => mocks.nativeText?.('pagué veinte mil'));
  expect(hook.result.current.value).toBe('Existing note pagué veinte mil');
  await act(async () => {
    await mocks.audio?.({ data: 'aaaa', format: 'webm' }, false);
  });
  await act(async () => {
    await mocks.audio?.({ data: 'aaaa', format: 'webm' }, true);
  });
  expect(hook.result.current.value).toBe('Existing note pagué 20000');
  const first = mocks.mutate.mock.calls[0][0],
    last = mocks.mutate.mock.calls[1][0];
  expect(first.session_id).toBe(last.session_id);
  expect([first.sequence, last.sequence]).toEqual([0, 1]);
  expect(last.final).toBe(true);
  hook.unmount();
});
it('preserves manual edits and reports unrelated speech without creating a transaction', async () => {
  const hook = fixture();
  await act(async () => hook.result.current.voice.start());
  act(() => mocks.nativeText?.('hola'));
  act(() => hook.result.current.setValue('My edited draft'));
  mocks.mutate.mockResolvedValue({ text: 'hola cómo estás', relevance: 'unrelated' });
  await act(async () => {
    await mocks.audio?.({ data: 'aaaa', format: 'webm' }, true);
  });
  expect(hook.result.current.value).toBe('My edited draft');
  expect(hook.result.current.voice.relevance).toBeNull();
  hook.unmount();
});

it('shows relevance for the dictated text and removes it after manual correction', async () => {
  const hook = fixture();
  await act(async () => hook.result.current.voice.start());
  mocks.mutate.mockResolvedValue({ text: 'hola cómo estás', relevance: 'unrelated' });
  await act(async () => {
    await mocks.audio?.({ data: 'aaaa', format: 'wav' }, true);
  });
  expect(hook.result.current.voice.relevance).toBe('unrelated');
  act(() => hook.result.current.setValue('Pagué 20000 por comida'));
  expect(hook.result.current.voice.relevance).toBeNull();
  hook.unmount();
});
