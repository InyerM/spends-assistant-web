import { getUserClient, AuthError, errorResponse } from '@/lib/api/server';
import { fetchUsdCopReference } from '@/lib/fx-reference';
import { z } from 'zod';
export async function GET(request: Request): Promise<Response> {
  try {
    await getUserClient(request);
    const date = new URL(request.url).searchParams.get('date');
    if (!z.iso.date().safeParse(date).success) return errorResponse('Invalid reference date', 400);
    const quote = await fetchUsdCopReference(date!);
    return quote
      ? Response.json(quote, { headers: { 'Cache-Control': 'private, max-age=3600' } })
      : errorResponse('No verified reference for this date', 404);
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Reference unavailable',
      error instanceof AuthError ? 401 : 503,
    );
  }
}
