import type { NextRequest } from 'next/server';
import {
  getAdminClient,
  jsonResponse,
  errorResponse,
  applyAutomationRules,
} from '@/lib/api/server';
import { workerConfig } from '@/lib/config';

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
  account_type?: string | null;
}

interface WorkerParseResponse {
  parsed: WorkerParsed;
  resolved: {
    account_id?: string;
    category_id?: string;
  };
}

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

    const data = (await res.json()) as WorkerParseResponse;

    // Apply automation rules to the parsed result
    const supabase = getAdminClient();
    const txForRules = {
      description: data.parsed.description,
      amount: data.parsed.amount,
      account_id: data.resolved.account_id ?? '',
      source: data.parsed.source || 'manual',
      type: data.parsed.type ?? 'expense',
      category_id: data.resolved.category_id,
    };

    const processed = await applyAutomationRules(supabase, txForRules);

    return jsonResponse({
      parsed: data.parsed,
      resolved: {
        account_id: processed.account_id || data.resolved.account_id,
        category_id: processed.category_id ?? data.resolved.category_id,
        transfer_to_account_id: processed.transfer_to_account_id,
        transfer_id: processed.transfer_id,
        type: processed.type,
      },
      applied_rules: processed.applied_rules ?? [],
    });
  } catch {
    return errorResponse('Failed to parse transaction');
  }
}
