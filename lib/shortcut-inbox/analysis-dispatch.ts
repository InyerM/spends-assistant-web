import type { SupabaseClient } from '@supabase/supabase-js';
import { workerConfig } from '@/lib/config';
import type { IntakeItemResult } from './intake';

/** Best-effort wakeup only: durable jobs already exist after the intake insert. */
export async function dispatchInboxAnalysis(
  request: Request,
  supabase: SupabaseClient,
  items: IntakeItemResult[],
): Promise<void> {
  const ids = [
    ...new Set(
      items.filter((item) => item.status === 'received' && item.id).map((item) => item.id!),
    ),
  ];
  if (!ids.length || !workerConfig.url) return;
  try {
    const authorization = request.headers.get('Authorization');
    const token = authorization ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    const bearer = authorization ?? `Bearer ${token}`;
    for (let offset = 0; offset < ids.length; offset += 25) {
      await fetch(`${workerConfig.url.replace(/\/$/u, '')}/inbox/analysis-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: bearer },
        body: JSON.stringify({ inbox_item_ids: ids.slice(offset, offset + 25) }),
        signal: AbortSignal.timeout(5000),
      });
    }
  } catch {
    // The scheduled Worker recovers persisted jobs; never lose accepted intake to a wakeup failure.
  }
}
