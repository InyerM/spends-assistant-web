import { expect, it } from 'vitest';
import { createVoiceActivity } from '@/lib/utils/voice-activity';
it('waits for speech, tolerates a pause and ends after 1.8 seconds of silence', () => {
  const sample = createVoiceActivity(0);
  expect(sample(100, 0)).toBe('listening');
  for (const now of [200, 300, 400]) expect(sample(now, 0.08)).toBe('listening');
  expect(sample(1500, 0)).toBe('listening');
  expect(sample(2200, 0)).toBe('silence');
});
it('does not treat quiet noise as speech and reports no speech after six seconds', () => {
  const sample = createVoiceActivity(0);
  expect(sample(5900, 0.005)).toBe('listening');
  expect(sample(6000, 0.005)).toBe('empty');
});
