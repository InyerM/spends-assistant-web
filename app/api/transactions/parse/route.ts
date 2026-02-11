import type { NextRequest } from 'next/server';
import { jsonResponse, errorResponse } from '@/lib/api/server';
import { workerConfig } from '@/lib/config';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!workerConfig.url || !workerConfig.apiKey) {
      return errorResponse('Worker not configured', 503);
    }

    const body = await request.json();
    const { text } = body as { text?: string };

    if (!text?.trim()) {
      return errorResponse('Text is required', 400);
    }

    const res = await fetch(`${workerConfig.url}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerConfig.apiKey}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Worker error' }));
      return errorResponse((err as { error: string }).error || 'Parse failed', res.status);
    }

    const data = await res.json();
    return jsonResponse(data);
  } catch {
    return errorResponse('Failed to parse transaction');
  }
}
