import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';

export async function POST(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const { accessToken, supabase } = await getUserClient(request);
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin) {
      return errorResponse('Invalid request origin', 403);
    }
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    if (!workerConfig.url) return errorResponse('Financial chat unavailable', 503);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (
      !body ||
      typeof body.question !== 'string' ||
      !body.question.trim() ||
      body.question.length > 2000 ||
      typeof body.month !== 'string' ||
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(body.month) ||
      body.corpusAcknowledged !== true
    ) {
      return errorResponse('Invalid financial chat request', 400);
    }
    const response = await fetch(`${workerConfig.url.replace(/\/$/u, '')}/financial/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: body.question,
        month: body.month,
        corpusAcknowledged: true,
      }),
      signal: AbortSignal.timeout(100_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      const status = [400, 401, 428, 429].includes(response.status) ? response.status : 503;
      return Response.json({ error: 'Financial chat unavailable' }, { status, headers });
    }
    return Response.json(await response.json(), { headers });
  } catch (error) {
    return Response.json(
      { error: error instanceof AuthError ? 'Unauthorized' : 'Financial chat unavailable' },
      { status: error instanceof AuthError ? 401 : 503, headers },
    );
  }
}
