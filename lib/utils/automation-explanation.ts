import type { CreateAutomationRuleInput } from '@/types';

export type AutomationExplanationDraft = Omit<
  CreateAutomationRuleInput,
  'prompt_text' | 'match_phone' | 'transfer_to_account_id'
> & {
  managed_account_id?: string | null;
  prompt_text?: string | null;
  match_phone?: string | null;
  transfer_to_account_id?: string | null;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .filter((key) => object[key] !== undefined)
        .map((key) => [key, canonical(object[key])]),
    );
  }
  return value;
}

export function automationExplanationIdentity(rule: AutomationExplanationDraft): string {
  return JSON.stringify(
    canonical({
      name: rule.name,
      rule_type: rule.rule_type ?? 'general',
      condition_logic: rule.condition_logic ?? 'and',
      priority: rule.priority ?? 0,
      is_active: rule.is_active !== false,
      managed_account_id: rule.managed_account_id ?? null,
      prompt_text: rule.prompt_text ?? null,
      match_phone: rule.match_phone ?? null,
      transfer_to_account_id: rule.transfer_to_account_id ?? null,
      conditions: rule.conditions,
      actions: rule.actions,
    }),
  );
}
