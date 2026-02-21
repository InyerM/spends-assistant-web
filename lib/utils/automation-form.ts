import type {
  AutomationRuleConditions,
  AutomationRuleActions,
  CreateAutomationRuleInput,
} from '@/types';

// ── Row types ──────────────────────────────────────────────────────────────

export type ConditionType =
  | 'raw_text_contains'
  | 'source'
  | 'amount_greater_than'
  | 'amount_less_than'
  | 'type';

export interface ConditionRow {
  id: string;
  type: ConditionType;
  value: string;
}

export type ActionType =
  | 'set_category'
  | 'set_type'
  | 'set_account'
  | 'transfer_to_account'
  | 'auto_reconcile'
  | 'add_note';

export interface ActionRow {
  id: string;
  type: ActionType;
  value: string;
}

// ── Label key maps ─────────────────────────────────────────────────────────

export const CONDITION_TYPE_KEYS: Record<ConditionType, string> = {
  raw_text_contains: 'rawTextContains',
  source: 'conditionSource',
  amount_greater_than: 'amountGreaterThan',
  amount_less_than: 'amountLessThan',
  type: 'transactionType',
};

export const ACTION_TYPE_KEYS: Record<ActionType, string> = {
  set_category: 'setCategory',
  set_type: 'setType',
  set_account: 'setAccount',
  transfer_to_account: 'transferToAccount',
  auto_reconcile: 'autoReconcile',
  add_note: 'addNote',
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── Convert existing rule data to dynamic rows ─────────────────────────────

export function conditionsToRows(conditions: AutomationRuleConditions): ConditionRow[] {
  const rows: ConditionRow[] = [];
  if (conditions.raw_text_contains) {
    for (const term of conditions.raw_text_contains) {
      rows.push({ id: generateId(), type: 'raw_text_contains', value: term });
    }
  }
  if (conditions.source) {
    for (const s of conditions.source) {
      rows.push({ id: generateId(), type: 'source', value: s });
    }
  }
  if (conditions.amount_between) {
    rows.push({
      id: generateId(),
      type: 'amount_greater_than',
      value: String(conditions.amount_between[0]),
    });
    rows.push({
      id: generateId(),
      type: 'amount_less_than',
      value: String(conditions.amount_between[1]),
    });
  }
  return rows;
}

export function actionsToRows(
  actions: AutomationRuleActions,
  transferToAccountId?: string | null,
): ActionRow[] {
  const rows: ActionRow[] = [];
  if (actions.set_type) {
    rows.push({ id: generateId(), type: 'set_type', value: actions.set_type });
  }
  if (actions.set_category) {
    rows.push({ id: generateId(), type: 'set_category', value: actions.set_category });
  }
  if (actions.set_account) {
    rows.push({ id: generateId(), type: 'set_account', value: actions.set_account });
  }
  if (actions.link_to_account || transferToAccountId) {
    rows.push({
      id: generateId(),
      type: 'transfer_to_account',
      value: actions.link_to_account ?? transferToAccountId ?? '',
    });
  }
  if (actions.auto_reconcile) {
    rows.push({ id: generateId(), type: 'auto_reconcile', value: 'true' });
  }
  if (actions.add_note) {
    rows.push({ id: generateId(), type: 'add_note', value: actions.add_note });
  }
  return rows;
}

// ── Build payload from form values + rows ──────────────────────────────────

export interface BuildPayloadFormValues {
  name: string;
  is_active: boolean;
  priority: number;
  rule_type: 'general' | 'account_detection' | 'transfer';
  condition_logic: 'and' | 'or';
}

export function buildPayload(
  values: BuildPayloadFormValues,
  conditionRows: ConditionRow[],
  actionRows: ActionRow[],
): CreateAutomationRuleInput {
  const conditions: AutomationRuleConditions = {};
  const rawTextTerms: string[] = [];
  const sourceTerms: string[] = [];
  let amountMin: number | undefined;
  let amountMax: number | undefined;

  for (const row of conditionRows) {
    if (!row.value.trim()) continue;
    switch (row.type) {
      case 'raw_text_contains':
        rawTextTerms.push(row.value.trim());
        break;
      case 'source':
        sourceTerms.push(row.value.trim());
        break;
      case 'amount_greater_than':
        amountMin = Number(row.value);
        break;
      case 'amount_less_than':
        amountMax = Number(row.value);
        break;
      case 'type':
        // stored as a condition if needed; for now map to source-style
        break;
    }
  }

  if (rawTextTerms.length > 0) conditions.raw_text_contains = rawTextTerms;
  if (sourceTerms.length > 0) conditions.source = sourceTerms;
  if (amountMin !== undefined && amountMax !== undefined) {
    conditions.amount_between = [amountMin, amountMax];
  } else if (amountMin !== undefined) {
    conditions.amount_between = [amountMin, Number.MAX_SAFE_INTEGER];
  } else if (amountMax !== undefined) {
    conditions.amount_between = [0, amountMax];
  }

  const actions: AutomationRuleActions = {};
  let transferToAccountId: string | undefined;

  for (const row of actionRows) {
    if (!row.value.trim() && row.type !== 'auto_reconcile') continue;
    switch (row.type) {
      case 'set_type':
        actions.set_type = row.value as 'expense' | 'income' | 'transfer';
        break;
      case 'set_category':
        actions.set_category = row.value;
        break;
      case 'set_account':
        actions.set_account = row.value;
        break;
      case 'transfer_to_account':
        actions.link_to_account = row.value;
        transferToAccountId = row.value;
        break;
      case 'auto_reconcile':
        if (row.value === 'true') actions.auto_reconcile = true;
        break;
      case 'add_note':
        actions.add_note = row.value.trim();
        break;
    }
  }

  return {
    name: values.name,
    is_active: values.is_active,
    priority: values.priority,
    rule_type: values.rule_type,
    condition_logic: values.condition_logic,
    transfer_to_account_id: transferToAccountId,
    conditions,
    actions,
  };
}
