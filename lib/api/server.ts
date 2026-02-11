import { createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutomationRule, AutomationRuleConditions, AutomationRuleActions } from '@/types';

export function getAdminClient(): SupabaseClient {
  return createAdminClient();
}

export function jsonResponse(data: unknown, status: number = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(message: string, status: number = 500): Response {
  return Response.json({ error: message }, { status });
}

export async function adjustAccountBalance(
  supabase: SupabaseClient,
  accountId: string,
  amount: number,
  operation: 'add' | 'subtract',
): Promise<void> {
  const { data } = await supabase.from('accounts').select('balance').eq('id', accountId).single();
  if (!data) return;
  const newBalance =
    operation === 'subtract'
      ? (data.balance as number) - amount
      : (data.balance as number) + amount;
  await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId);
}

export async function applyTransactionBalance(
  supabase: SupabaseClient,
  type: string,
  accountId: string,
  amount: number,
  transferToAccountId?: string | null,
  reverse: boolean = false,
): Promise<void> {
  const op = (normal: 'add' | 'subtract'): 'add' | 'subtract' =>
    reverse ? (normal === 'add' ? 'subtract' : 'add') : normal;

  if (type === 'expense') {
    await adjustAccountBalance(supabase, accountId, amount, op('subtract'));
  } else if (type === 'income') {
    await adjustAccountBalance(supabase, accountId, amount, op('add'));
  } else if (type === 'transfer' && transferToAccountId) {
    await adjustAccountBalance(supabase, accountId, amount, op('subtract'));
    await adjustAccountBalance(supabase, transferToAccountId, amount, op('add'));
  }
}

interface TransactionForRules {
  description: string;
  amount: number;
  account_id: string;
  source: string;
  type: string;
  category_id?: string;
  transfer_to_account_id?: string;
  transfer_id?: string;
  notes?: string;
  [key: string]: unknown;
}

function matchesConditions(tx: TransactionForRules, conditions: AutomationRuleConditions): boolean {
  if (conditions.description_contains) {
    const desc = tx.description.toLowerCase();
    const matches = conditions.description_contains.some((kw) => desc.includes(kw.toLowerCase()));
    if (!matches) return false;
  }
  if (conditions.description_regex) {
    const regex = new RegExp(conditions.description_regex, 'i');
    if (!regex.test(tx.description)) return false;
  }
  if (conditions.amount_between) {
    const [min, max] = conditions.amount_between;
    if (tx.amount < min || tx.amount > max) return false;
  }
  if (conditions.amount_equals !== undefined) {
    if (tx.amount !== conditions.amount_equals) return false;
  }
  if (conditions.from_account) {
    if (tx.account_id !== conditions.from_account) return false;
  }
  if (conditions.source) {
    if (!conditions.source.includes(tx.source)) return false;
  }
  return true;
}

function applyActions(
  tx: TransactionForRules,
  actions: AutomationRuleActions,
): TransactionForRules {
  const result = { ...tx };
  if (actions.set_type) {
    result.type = actions.set_type;
  }
  if (actions.set_category !== undefined) {
    result.category_id = actions.set_category ?? undefined;
  }
  if (actions.link_to_account) {
    result.transfer_to_account_id = actions.link_to_account;
    result.transfer_id = crypto.randomUUID();
  }
  if (actions.add_note) {
    result.notes = result.notes ? `${result.notes}\n${actions.add_note}` : actions.add_note;
  }
  return result;
}

export async function applyAutomationRules(
  supabase: SupabaseClient,
  transaction: TransactionForRules,
): Promise<TransactionForRules> {
  const { data: rules } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('priority', { ascending: false });

  if (!rules) return transaction;

  let result = transaction;
  const appliedRules: { rule_id: string; rule_name: string; actions: Record<string, unknown> }[] =
    [];

  for (const rule of rules as AutomationRule[]) {
    if (matchesConditions(result, rule.conditions)) {
      const actions = { ...rule.actions };
      if (rule.transfer_to_account_id && !actions.link_to_account) {
        actions.link_to_account = rule.transfer_to_account_id;
      }
      result = applyActions(result, actions);
      appliedRules.push({
        rule_id: rule.id,
        rule_name: rule.name,
        actions: rule.actions as Record<string, unknown>,
      });
    }
  }

  if (appliedRules.length > 0) {
    result.applied_rules = appliedRules;
  }

  return result;
}
