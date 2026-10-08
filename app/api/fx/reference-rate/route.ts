import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { fetchUsdCopReferenceRate } from '@/lib/fx/reference-rate';

const dateSchema = z.iso.date();

export async function GET(request: NextRequest): Promise<Response> {
  const date = dateSchema.safeParse(request.nextUrl.searchParams.get('date'));
  if (!date.success) return errorResponse('A valid date is required', 400);

  try {
    await getUserClient();
    const quote = await fetchUsdCopReferenceRate(date.data);
    return Response.json(quote, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Reference rate unavailable', 503);
  }
}
