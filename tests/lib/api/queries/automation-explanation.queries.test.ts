import { describe, it, expect, vi } from 'vitest';
import {
  fetchAutomationExplanation,
  automationExplanationKey,
} from '@/lib/api/queries/automation-explanation.queries';
const rule = {
  name: 'Coffee',
  conditions: { raw_text_contains: ['coffee'] },
  actions: { add_note: 'Reviewed' },
};
describe('automation explanation API', () => {
  it('keys behavior and owner/locale but ignores updated row metadata', () => {
    expect(automationExplanationKey('owner', rule, 'es')).toEqual(
      automationExplanationKey('owner', { ...rule, updated_at: 'later' } as typeof rule, 'es'),
    );
    expect(automationExplanationKey('other', rule, 'es')).not.toEqual(
      automationExplanationKey('owner', rule, 'es'),
    );
  });
  it('preserves consent errors and requests only the draft plus locale', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: 'AI_CONSENT_REQUIRED', scope: 'financial_text', version: 'external-ai-v1' },
            { status: 428 },
          ),
        ),
    );
    await expect(fetchAutomationExplanation(rule, 'es')).rejects.toMatchObject({
      scope: 'financial_text',
    });
  });
});
