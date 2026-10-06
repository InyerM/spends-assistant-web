import { describe, expect, it } from 'vitest';
import {
  AiConsentRequiredError,
  aiConsentErrorFromResponse,
  forwardAiConsentError,
} from '@/lib/ai-consent';

describe('AI consent errors', () => {
  it('preserves a valid required scope and version from a Worker response', async () => {
    const response = Response.json(
      { code: 'AI_CONSENT_REQUIRED', scope: 'document_images', version: 'external-ai-v1' },
      { status: 428 },
    );
    const forwarded = await forwardAiConsentError(response);
    expect(forwarded?.status).toBe(428);
    expect(await forwarded?.json()).toEqual({
      code: 'AI_CONSENT_REQUIRED',
      scope: 'document_images',
      version: 'external-ai-v1',
    });
  });

  it('rejects malformed required-consent responses', async () => {
    expect(
      await forwardAiConsentError(
        Response.json({ code: 'AI_CONSENT_REQUIRED', scope: 'all' }, { status: 428 }),
      ),
    ).toBeNull();
  });

  it('creates a typed error for a relevant UI prompt', async () => {
    const error = await aiConsentErrorFromResponse(
      Response.json(
        { code: 'AI_CONSENT_REQUIRED', scope: 'financial_text', version: 'external-ai-v1' },
        { status: 428 },
      ),
    );
    expect(error).toBeInstanceOf(AiConsentRequiredError);
    expect(error).toMatchObject({ scope: 'financial_text' });
  });
});
