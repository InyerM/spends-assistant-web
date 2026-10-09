import type { NextRequest } from 'next/server';
import { AuthError, getUserClient, errorResponse } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return errorResponse('Unauthorized', 401);
    if (!workerConfig.url) return errorResponse('Worker not configured', 503);
    const body: unknown = await request.json();
    const response = await fetch(`${workerConfig.url.replace(/\/$/u, '')}/automation/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    return Response.json(await response.json(), {
      status: response.status,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(
      error instanceof AuthError ? 'Unauthorized' : 'Explanation unavailable',
      error instanceof AuthError ? 401 : 503,
    );
  }
}
