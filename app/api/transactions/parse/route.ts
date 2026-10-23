import { readBoundedJson, RequestBodyError } from '@/lib/api/bounded-json';
import type { NextRequest } from 'next/server';
import {
  getUserClient,
  AuthError,
  jsonResponse,
  errorResponse,
  applyAutomationRules,
} from '@/lib/api/server';
import { workerConfig } from '@/lib/config';
import { forwardAiConsentError } from '@/lib/ai-consent';

interface WorkerParsed {
  amount: number;
  description: string;
  category: string;
  source: string;
  type?: string;
  bank?: string;
  payment_type?: string;
  confidence: number;
  original_date?: string | null;
  original_time?: string | null;
  last_four?: string | null;
  notes?: string;
  account_type?: string | null;
}

interface WorkerParseResponse {
  parsed: WorkerParsed;
  resolved: {
    account_id?: string;
    category_id?: string;
    notes?: string;
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    if (!workerConfig.url) {
      return errorResponse('Worker not configured', 503);
    }

    const { supabase, accessToken } = await getUserClient(request);
    if (!accessToken && request.headers.get('Origin') !== new URL(request.url).origin)
      return errorResponse('Invalid request origin', 403);
    const authToken = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!authToken) return errorResponse('No authentication token available', 401);
    let body: unknown;
    try {
      body = await readBoundedJson(request, 128 * 1024);
    } catch (error) {
      return errorResponse(
        'Invalid parse request',
        error instanceof RequestBodyError ? error.status : 400,
      );
    }
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !('text' in body) ||
      typeof body.text !== 'string' ||
      !body.text.trim() ||
      body.text.length > 16384
    )
      return errorResponse('Valid text is required (maximum 16384 characters)', 400);
    const text = body.text;

    const res = await fetch(`${workerConfig.url}/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const consentError = await forwardAiConsentError(res);
      if (consentError) return consentError;
      const err = await res.json().catch(() => ({ error: 'Worker error' }));
      const errObj = err as { error: string; code?: string; used?: number; limit?: number };

      if (res.status === 429 && errObj.code === 'PARSE_LIMIT_REACHED') {
        return Response.json(
          {
            error: errObj.error,
            code: errObj.code,
            used: errObj.used,
            limit: errObj.limit,
          },
          { status: 429 },
        );
      }

      return errorResponse(errObj.error || 'Parse failed', res.status);
    }

    const data = (await res.json()) as WorkerParseResponse | { status: string; reason: string };

    // Handle non-transactional messages (skipped by AI)
    if ('status' in data && data.status === 'skipped') {
      return jsonResponse({
        status: 'skipped',
        reason: data.reason,
      });
    }

    const parsed = data as WorkerParseResponse;

    // Apply automation rules to the parsed result (RLS filters rules to this user)
    const txForRules = {
      description: parsed.parsed.description,
      amount: parsed.parsed.amount,
      account_id: parsed.resolved.account_id ?? '',
      source: parsed.parsed.source || 'manual',
      type: parsed.parsed.type ?? 'expense',
      category_id: parsed.resolved.category_id,
      raw_text: text,
      ...(typeof parsed.resolved.notes === 'string' && parsed.resolved.notes.length <= 500
        ? { notes: parsed.resolved.notes }
        : {}),
    };

    const processed = await applyAutomationRules(supabase, txForRules);

    return jsonResponse({
      parsed: parsed.parsed,
      resolved: {
        account_id: processed.account_id || parsed.resolved.account_id,
        category_id: processed.category_id ?? parsed.resolved.category_id,
        transfer_to_account_id: processed.transfer_to_account_id,
        transfer_id: processed.transfer_id,
        type: processed.type,
        notes: processed.notes,
      },
      original: {
        account_id: parsed.resolved.account_id,
        category_id: parsed.resolved.category_id,
      },
      applied_rules: processed.applied_rules ?? [],
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to parse transaction');
  }
}
