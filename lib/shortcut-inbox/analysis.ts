import type { SupabaseClient } from '@supabase/supabase-js';
import type { InboxAnalysis, InboxAnalysisJob } from '@/types/shortcut-inbox';

const ANALYSIS_COLUMNS =
  'inbox_item_id,user_id,analysis_version,status,merchant,amount,bank_event_at,card_last_four,account_id,category_id,category_source,suggested_type,description,notes,analysis_details';
const JOB_COLUMNS =
  'inbox_item_id,user_id,state,attempts,last_error,available_at,created_at,updated_at';
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Flatten an explicit public whitelist; details never replace canonical columns. */
export function normalizeInboxAnalysis(value: unknown): InboxAnalysis | undefined {
  const row = record(value);
  if (
    !row ||
    row.analysis_version !== 3 ||
    !['parsed', 'needs_review'].includes(String(row.status))
  )
    return undefined;
  const details = record(row.analysis_details) ?? row;
  return {
    inbox_item_id: text(row.inbox_item_id) ?? undefined,
    analysis_version: 3,
    status: row.status as InboxAnalysis['status'],
    account_id: text(row.account_id),
    category_id: text(row.category_id),
    category_source: ['ai', 'catalog', 'automation', 'review_context'].includes(
      String(row.category_source),
    )
      ? (row.category_source as InboxAnalysis['category_source'])
      : null,
    merchant: text(row.merchant),
    amount: typeof row.amount === 'number' || typeof row.amount === 'string' ? row.amount : null,
    bank_event_at: text(row.bank_event_at),
    card_last_four: text(row.card_last_four),
    suggested_type:
      row.suggested_type === 'expense' || row.suggested_type === 'income'
        ? row.suggested_type
        : null,
    description: text(row.description),
    notes: text(row.notes),
    explanation: text(details.explanation),
    event_date: text(details.event_date),
    financial_type: ['expense', 'income', 'transfer'].includes(String(details.financial_type))
      ? (details.financial_type as InboxAnalysis['financial_type'])
      : null,
    transfer_to_account_id: text(details.transfer_to_account_id),
    ...(['ai', 'automation', 'history', 'evidence'].includes(String(details.analysis_source))
      ? { analysis_source: details.analysis_source as InboxAnalysis['analysis_source'] }
      : {}),
    automation_fields: strings(details.automation_fields),
    history_fields: strings(details.history_fields),
    evidence_ids: strings(details.evidence_ids),
    applied_rules: Array.isArray(details.applied_rules)
      ? details.applied_rules.flatMap((value) => {
          const rule = record(value);
          return rule && typeof rule.rule_id === 'string' && typeof rule.rule_name === 'string'
            ? [{ rule_id: rule.rule_id, rule_name: rule.rule_name }]
            : [];
        })
      : [],
  };
}

export async function enrichInboxAnalysis<T extends { id: string }>(
  supabase: SupabaseClient,
  owner: string,
  rows: T[],
): Promise<Array<T & { analysis?: InboxAnalysis; analysis_job?: InboxAnalysisJob }>> {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const [analyses, jobs] = await Promise.all([
    supabase
      .from('forwarded_email_analyses')
      .select(ANALYSIS_COLUMNS)
      .eq('user_id', owner)
      .in('inbox_item_id', ids),
    supabase
      .from('inbox_analysis_jobs')
      .select(JOB_COLUMNS)
      .eq('user_id', owner)
      .in('inbox_item_id', ids),
  ]);
  if (analyses.error || jobs.error) throw new Error('Inbox analysis lookup failed');
  const byId = new Map<string, InboxAnalysis>();
  for (const value of analyses.data as unknown[]) {
    const row = record(value);
    if (
      !row ||
      row.user_id !== owner ||
      typeof row.inbox_item_id !== 'string' ||
      !ids.includes(row.inbox_item_id)
    )
      continue;
    const proposal = normalizeInboxAnalysis(row);
    if (proposal) byId.set(row.inbox_item_id, proposal);
  }
  const jobById = new Map<string, InboxAnalysisJob>();
  for (const value of jobs.data as unknown[]) {
    const row = record(value);
    if (
      !row ||
      row.user_id !== owner ||
      typeof row.inbox_item_id !== 'string' ||
      !ids.includes(row.inbox_item_id) ||
      typeof row.state !== 'string' ||
      !['pending', 'running', 'ready', 'blocked', 'failed', 'skipped'].includes(row.state) ||
      typeof row.attempts !== 'number' ||
      !Number.isSafeInteger(row.attempts) ||
      row.attempts < 0
    )
      continue;
    jobById.set(row.inbox_item_id, {
      state: row.state as InboxAnalysisJob['state'],
      attempts: row.attempts,
      last_error: text(row.last_error),
      available_at: text(row.available_at) ?? undefined,
      updated_at: text(row.updated_at) ?? undefined,
    });
  }
  return rows.map((row) => ({
    ...row,
    ...(byId.get(row.id) ? { analysis: byId.get(row.id) } : {}),
    ...(jobById.has(row.id) ? { analysis_job: jobById.get(row.id) } : {}),
  }));
}

/** An analysis proposes intent; available owned account options still gate destination defaults. */
export function analysisTransferDestination(
  analysis: InboxAnalysis | undefined,
  accounts: Array<{ id: string; currency: string; is_active: boolean; deleted_at?: string | null }>,
): string {
  if (
    analysis?.financial_type !== 'transfer' ||
    !analysis.account_id ||
    !analysis.transfer_to_account_id ||
    analysis.account_id === analysis.transfer_to_account_id
  )
    return '';
  const available = (id: string): boolean =>
    accounts.some(
      (account) =>
        account.id === id && account.currency === 'COP' && account.is_active && !account.deleted_at,
    );
  return available(analysis.account_id) && available(analysis.transfer_to_account_id)
    ? analysis.transfer_to_account_id
    : '';
}
