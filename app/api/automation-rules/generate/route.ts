import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!workerConfig.url) {
      return errorResponse('Worker not configured', 503);
    }

    const { supabase } = await getUserClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const authToken = session?.access_token;
    if (!authToken) {
      return errorResponse('No authentication token available', 401);
    }

    const body = await request.json();
    const { prompt } = body as { prompt?: string };

    if (!prompt?.trim()) {
      return errorResponse('Prompt is required', 400);
    }

    const res = await fetch(`${workerConfig.url}/automation/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Worker error' }));
      return errorResponse((err as { error: string }).error || 'Generation failed', res.status);
    }

    const data = await res.json();
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to generate automation rules');
  }
}
