import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

async function forwardToWorker(method: 'GET' | 'POST' | 'PATCH' | 'DELETE'): Promise<Response> {
  try {
    const { supabase } = await getUserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return errorResponse('Unauthorized', 401);
    if (!workerConfig.url) return errorResponse('Worker not configured', 503);

    const response = await fetch(`${workerConfig.url.replace(/\/$/, '')}/email-forwarding-route`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });

    if (response.status === 204)
      return new Response(null, { status: 204, headers: privateHeaders });

    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        result &&
        typeof result === 'object' &&
        'error' in result &&
        typeof result.error === 'string'
          ? result.error
          : 'Email forwarding request failed';
      return Response.json({ error }, { status: response.status, headers: privateHeaders });
    }
    return Response.json(result, { status: response.status, headers: privateHeaders });
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Email forwarding request failed');
  }
}

export function GET(): Promise<Response> {
  return forwardToWorker('GET');
}

export function POST(): Promise<Response> {
  return forwardToWorker('POST');
}

export function PATCH(): Promise<Response> {
  return forwardToWorker('PATCH');
}

export function DELETE(): Promise<Response> {
  return forwardToWorker('DELETE');
}
