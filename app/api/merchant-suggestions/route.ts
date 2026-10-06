import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';

export async function POST(request: Request): Promise<Response> {
  try {
    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin) {
      return errorResponse('Invalid request origin', 403);
    }

    const body = (await request.json()) as { merchant?: unknown };
    const merchant = body.merchant;
    if (
      typeof merchant !== 'string' ||
      merchant.trim().length < 2 ||
      merchant.trim().length > 120 ||
      [...merchant].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    ) {
      return errorResponse('Invalid merchant', 400);
    }
    if (!workerConfig.url) return errorResponse('Worker not configured', 503);

    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return errorResponse('Unauthorized', 401);
    const response = await fetch(`${workerConfig.url.replace(/\/$/u, '')}/merchant/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ merchant: merchant.trim() }),
    });
    if (!response.ok) return errorResponse('Merchant suggestion unavailable', 503);
    const result = (await response.json()) as { category_id?: unknown; source?: unknown };
    if (
      (result.category_id !== null && typeof result.category_id !== 'string') ||
      (result.source !== null && !['ai', 'catalog'].includes(result.source as string))
    ) {
      return errorResponse('Merchant suggestion unavailable', 503);
    }
    return Response.json(
      { category_id: result.category_id, source: result.source },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Merchant suggestion unavailable', 503);
  }
}
