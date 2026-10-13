import { expect, it } from 'vitest';
import { encodeVoiceWav } from '@/lib/utils/voice-wav';
it('encodes mono speech at 16kHz with a complete WAV header and signed PCM samples', async () => {
  const data = encodeVoiceWav([new Float32Array([0, 1, -1, 0.5])], 16000);
  const bytes = new Uint8Array(data),
    view = new DataView(data);
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint32(40, true)).toBe(8);
  expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([
    0, 32767, -32768,
  ]);
});
