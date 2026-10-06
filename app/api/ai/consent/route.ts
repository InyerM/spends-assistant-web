import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { AI_CONSENT_SCOPES, parseAiConsentState } from '@/lib/ai-consent';
import { workerConfig } from '@/lib/config';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

async function userToken(request: Request): Promise<{ token: string | null; bearer: boolean }> {
  const { accessToken, supabase } = await getUserClient(request);
  return {
    token: accessToken ?? (await supabase.auth.getSession()).data.session?.access_token ?? null,
    bearer: Boolean(accessToken),
  };
}

async function proxyConsent(token: string, choice?: unknown): Promise<Response> {
  if (!workerConfig.url) return errorResponse('AI consent unavailable', 503);
  const response = await fetch(`${workerConfig.url.replace(/\/$/u, '')}/ai/consent`, {
    ...(choice === undefined ? {} : { method: 'POST', body: JSON.stringify(choice) }),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(choice === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  });
  if (!response.ok) {
    const status = response.status === 401 ? 401 : response.status === 400 ? 400 : 503;
    return Response.json({ error: 'AI consent unavailable' }, { status, headers: privateHeaders });
  }
  const state = parseAiConsentState(await response.json().catch(() => null));
  if (!state)
    return Response.json(
      { error: 'AI consent unavailable' },
      { status: 503, headers: privateHeaders },
    );
  return Response.json(state, { headers: privateHeaders });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { token } = await userToken(request);
    return token ? await proxyConsent(token) : errorResponse('Unauthorized', 401);
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('AI consent unavailable', 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { token, bearer } = await userToken(request);
    if (!token) return errorResponse('Unauthorized', 401);
    if (!bearer && request.headers.get('Origin') !== new URL(request.url).origin) {
      return errorResponse('Invalid request origin', 403);
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      !body ||
      !AI_CONSENT_SCOPES.some((scope) => scope === body.scope) ||
      typeof body.granted !== 'boolean' ||
      typeof body.version !== 'string' ||
      !body.version
    ) {
      return errorResponse('Invalid AI consent choice', 400);
    }
    return await proxyConsent(token, {
      scope: body.scope,
      granted: body.granted,
      version: body.version,
    });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('AI consent unavailable', 503);
  }
}
