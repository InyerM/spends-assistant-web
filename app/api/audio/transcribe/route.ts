import { hasSameRequestOrigin } from '@/lib/api/request-origin';
import { getUserClient, AuthError, errorResponse } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';
export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    if (!accessToken && !hasSameRequestOrigin(request))
      return errorResponse('Invalid request origin', 403);
    const raw = await request.text();
    if (raw.length > 2800000) return errorResponse('Audio too large', 413);
    if (!workerConfig.url) return errorResponse('Worker not configured', 503);
    const response = await fetch(`${workerConfig.url}/audio/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: raw,
      signal: AbortSignal.timeout(35000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError
        ? error.status === 403
          ? 'Invalid request origin'
          : 'Unauthorized'
        : 'Audio transcription unavailable',
      error instanceof AuthError ? (error.status === 403 ? 403 : 401) : 502,
    );
  }
}
