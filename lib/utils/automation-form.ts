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

  interface ConditionAccumulator {
    rawTextTerms: string[];
    sourceTerms: string[];
    amountMin: number | undefined;
    amountMax: number | undefined;
  }

  const CONDITION_HANDLERS: Record<
    ConditionType,
    (acc: ConditionAccumulator, value: string) => void
  > = {
    raw_text_contains: (acc, value) => acc.rawTextTerms.push(value.trim()),
    source: (acc, value) => acc.sourceTerms.push(value.trim()),
    amount_greater_than: (acc, value) => {
      acc.amountMin = Number(value);
    },
    amount_less_than: (acc, value) => {
      acc.amountMax = Number(value);
    },
    type: () => {
      /* noop */
    },
  };

  const condAcc: ConditionAccumulator = {
    rawTextTerms: [],
    sourceTerms: [],
    amountMin: undefined,
    amountMax: undefined,
  };

  for (const row of conditionRows) {
    if (!row.value.trim()) continue;
    CONDITION_HANDLERS[row.type](condAcc, row.value);
  }

  if (condAcc.rawTextTerms.length > 0) conditions.raw_text_contains = condAcc.rawTextTerms;
  if (condAcc.sourceTerms.length > 0) conditions.source = condAcc.sourceTerms;
  if (condAcc.amountMin !== undefined && condAcc.amountMax !== undefined) {
    conditions.amount_between = [condAcc.amountMin, condAcc.amountMax];
  } else if (condAcc.amountMin !== undefined) {
    conditions.amount_between = [condAcc.amountMin, Number.MAX_SAFE_INTEGER];
  } else if (condAcc.amountMax !== undefined) {
    conditions.amount_between = [0, condAcc.amountMax];
  }

  const actions: AutomationRuleActions = {};

  interface ActionContext {
    actions: AutomationRuleActions;
    transferToAccountId: string | undefined;
  }

  const ACTION_HANDLERS: Record<ActionType, (ctx: ActionContext, value: string) => void> = {
    set_type: (ctx, value) => {
      ctx.actions.set_type = value as 'expense' | 'income' | 'transfer';
    },
    set_category: (ctx, value) => {
      ctx.actions.set_category = value;
    },
    set_account: (ctx, value) => {
      ctx.actions.set_account = value;
    },
    transfer_to_account: (ctx, value) => {
      ctx.actions.link_to_account = value;
      ctx.transferToAccountId = value;
    },
    auto_reconcile: (ctx, value) => {
      if (value === 'true') ctx.actions.auto_reconcile = true;
    },
    add_note: (ctx, value) => {
      ctx.actions.add_note = value.trim();
    },
  };

  const actionCtx: ActionContext = { actions, transferToAccountId: undefined };

  for (const row of actionRows) {
    if (!row.value.trim() && row.type !== 'auto_reconcile') continue;
    ACTION_HANDLERS[row.type](actionCtx, row.value);
  }

  return {
    name: values.name,
    is_active: values.is_active,
    priority: values.priority,
    rule_type: values.rule_type,
    condition_logic: values.condition_logic,
    transfer_to_account_id: actionCtx.transferToAccountId,
    conditions,
    actions,
  };
}
