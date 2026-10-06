export const AI_CONSENT_VERSION = 'external-ai-v1' as const;
export const AI_CONSENT_SCOPES = ['financial_text', 'document_images', 'forwarded_email'] as const;

export type AiConsentScope = (typeof AI_CONSENT_SCOPES)[number];

export interface AiConsentState {
  version: typeof AI_CONSENT_VERSION;
  consents: Record<AiConsentScope, boolean>;
}

export class AiConsentRequiredError extends Error {
  public constructor(public readonly scope: AiConsentScope) {
    super('AI consent required');
    this.name = 'AiConsentRequiredError';
  }
}

function isScope(value: unknown): value is AiConsentScope {
  return AI_CONSENT_SCOPES.some((scope) => scope === value);
}

function readRequiredConsent(value: unknown): { scope: AiConsentScope; version: string } | null {
  if (typeof value !== 'object' || value === null) return null;
  const result = value as Record<string, unknown>;
  if (result.code !== 'AI_CONSENT_REQUIRED' || !isScope(result.scope)) return null;
  if (typeof result.version !== 'string' || !result.version) return null;
  return { scope: result.scope, version: result.version };
}

export async function forwardAiConsentError(response: Response): Promise<Response | null> {
  if (response.status !== 428) return null;
  const result = readRequiredConsent(
    await response
      .clone()
      .json()
      .catch(() => null),
  );
  if (!result) return null;
  return Response.json(
    { code: 'AI_CONSENT_REQUIRED', ...result },
    { status: 428, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function aiConsentErrorFromResponse(
  response: Response,
): Promise<AiConsentRequiredError | null> {
  if (response.status !== 428) return null;
  const result = readRequiredConsent(
    await response
      .clone()
      .json()
      .catch(() => null),
  );
  return result ? new AiConsentRequiredError(result.scope) : null;
}

export function parseAiConsentState(value: unknown): AiConsentState | null {
  if (typeof value !== 'object' || value === null) return null;
  const state = value as Record<string, unknown>;
  if (state.version !== AI_CONSENT_VERSION) return null;
  if (typeof state.consents !== 'object' || state.consents === null) return null;
  const consents = state.consents as Record<string, unknown>;
  if (AI_CONSENT_SCOPES.some((scope) => typeof consents[scope] !== 'boolean')) return null;
  return {
    version: AI_CONSENT_VERSION,
    consents: {
      financial_text: consents.financial_text as boolean,
      document_images: consents.document_images as boolean,
      forwarded_email: consents.forwarded_email as boolean,
    },
  };
}
