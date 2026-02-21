import { describe, it, expect } from 'vitest';
import {
  generateId,
  conditionsToRows,
  actionsToRows,
  buildPayload,
  CONDITION_TYPE_KEYS,
  ACTION_TYPE_KEYS,
} from '@/lib/utils/automation-form';
import type { AutomationRuleConditions, AutomationRuleActions } from '@/types';

describe('generateId', () => {
  it('returns a string of length 7', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(7);
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('conditionsToRows', () => {
  it('returns empty array for empty conditions', () => {
    const rows = conditionsToRows({});
    expect(rows).toEqual([]);
  });

  it('converts raw_text_contains to rows', () => {
    const conditions: AutomationRuleConditions = {
      raw_text_contains: ['uber', 'lyft'],
    };
    const rows = conditionsToRows(conditions);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('raw_text_contains');
    expect(rows[0].value).toBe('uber');
    expect(rows[1].type).toBe('raw_text_contains');
    expect(rows[1].value).toBe('lyft');
  });

  it('converts source to rows', () => {
    const conditions: AutomationRuleConditions = {
      source: ['bank_a', 'bank_b'],
    };
    const rows = conditionsToRows(conditions);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('source');
    expect(rows[0].value).toBe('bank_a');
  });

  it('converts amount_between to two rows', () => {
    const conditions: AutomationRuleConditions = {
      amount_between: [100, 500],
    };
    const rows = conditionsToRows(conditions);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('amount_greater_than');
    expect(rows[0].value).toBe('100');
    expect(rows[1].type).toBe('amount_less_than');
    expect(rows[1].value).toBe('500');
  });

  it('converts mixed conditions', () => {
    const conditions: AutomationRuleConditions = {
      raw_text_contains: ['grocery'],
      source: ['chase'],
      amount_between: [10, 200],
    };
    const rows = conditionsToRows(conditions);
    expect(rows).toHaveLength(4);
  });
});

describe('actionsToRows', () => {
  it('returns empty array for empty actions', () => {
    const rows = actionsToRows({});
    expect(rows).toEqual([]);
  });

  it('converts set_type', () => {
    const actions: AutomationRuleActions = { set_type: 'expense' };
    const rows = actionsToRows(actions);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('set_type');
    expect(rows[0].value).toBe('expense');
  });

  it('converts set_category', () => {
    const actions: AutomationRuleActions = { set_category: 'cat-123' };
    const rows = actionsToRows(actions);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('set_category');
    expect(rows[0].value).toBe('cat-123');
  });

  it('converts set_account', () => {
    const actions: AutomationRuleActions = { set_account: 'acc-123' };
    const rows = actionsToRows(actions);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('set_account');
    expect(rows[0].value).toBe('acc-123');
  });

  it('converts link_to_account', () => {
    const actions: AutomationRuleActions = { link_to_account: 'acc-456' };
    const rows = actionsToRows(actions);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('transfer_to_account');
    expect(rows[0].value).toBe('acc-456');
  });

  it('uses transferToAccountId when link_to_account is not set', () => {
    const rows = actionsToRows({}, 'acc-789');
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('transfer_to_account');
    expect(rows[0].value).toBe('acc-789');
  });

  it('converts auto_reconcile', () => {
    const actions: AutomationRuleActions = { auto_reconcile: true };
    const rows = actionsToRows(actions);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('auto_reconcile');
    expect(rows[0].value).toBe('true');
  });

  it('converts add_note', () => {
    const actions: AutomationRuleActions = { add_note: 'Test note' };
    const rows = actionsToRows(actions);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('add_note');
    expect(rows[0].value).toBe('Test note');
  });

  it('converts all actions together', () => {
    const actions: AutomationRuleActions = {
      set_type: 'income',
      set_category: 'cat-1',
      set_account: 'acc-1',
      auto_reconcile: true,
      add_note: 'automated',
    };
    const rows = actionsToRows(actions);
    expect(rows).toHaveLength(5);
  });
});

describe('buildPayload', () => {
  const baseValues = {
    name: 'Test Rule',
    is_active: true,
    priority: 1,
    rule_type: 'general' as const,
    condition_logic: 'and' as const,
  };

  it('builds payload with empty rows', () => {
    const payload = buildPayload(baseValues, [], []);
    expect(payload).toEqual({
      name: 'Test Rule',
      is_active: true,
      priority: 1,
      rule_type: 'general',
      condition_logic: 'and',
      transfer_to_account_id: undefined,
      conditions: {},
      actions: {},
    });
  });

  it('builds payload with raw_text_contains conditions', () => {
    const conditions = [
      { id: '1', type: 'raw_text_contains' as const, value: 'uber' },
      { id: '2', type: 'raw_text_contains' as const, value: 'lyft' },
    ];
    const payload = buildPayload(baseValues, conditions, []);
    expect(payload.conditions.raw_text_contains).toEqual(['uber', 'lyft']);
  });

  it('builds payload with source conditions', () => {
    const conditions = [{ id: '1', type: 'source' as const, value: 'bank_a' }];
    const payload = buildPayload(baseValues, conditions, []);
    expect(payload.conditions.source).toEqual(['bank_a']);
  });

  it('builds payload with amount_between from two rows', () => {
    const conditions = [
      { id: '1', type: 'amount_greater_than' as const, value: '100' },
      { id: '2', type: 'amount_less_than' as const, value: '500' },
    ];
    const payload = buildPayload(baseValues, conditions, []);
    expect(payload.conditions.amount_between).toEqual([100, 500]);
  });

  it('builds payload with only amount_greater_than', () => {
    const conditions = [{ id: '1', type: 'amount_greater_than' as const, value: '100' }];
    const payload = buildPayload(baseValues, conditions, []);
    expect(payload.conditions.amount_between).toEqual([100, Number.MAX_SAFE_INTEGER]);
  });

  it('builds payload with only amount_less_than', () => {
    const conditions = [{ id: '1', type: 'amount_less_than' as const, value: '500' }];
    const payload = buildPayload(baseValues, conditions, []);
    expect(payload.conditions.amount_between).toEqual([0, 500]);
  });

  it('skips conditions with empty values', () => {
    const conditions = [
      { id: '1', type: 'raw_text_contains' as const, value: '' },
      { id: '2', type: 'raw_text_contains' as const, value: '  ' },
    ];
    const payload = buildPayload(baseValues, conditions, []);
    expect(payload.conditions.raw_text_contains).toBeUndefined();
  });

  it('builds payload with set_type action', () => {
    const actions = [{ id: '1', type: 'set_type' as const, value: 'expense' }];
    const payload = buildPayload(baseValues, [], actions);
    expect(payload.actions.set_type).toBe('expense');
  });

  it('builds payload with set_category action', () => {
    const actions = [{ id: '1', type: 'set_category' as const, value: 'cat-123' }];
    const payload = buildPayload(baseValues, [], actions);
    expect(payload.actions.set_category).toBe('cat-123');
  });

  it('builds payload with transfer_to_account action', () => {
    const actions = [{ id: '1', type: 'transfer_to_account' as const, value: 'acc-456' }];
    const payload = buildPayload(baseValues, [], actions);
    expect(payload.actions.link_to_account).toBe('acc-456');
    expect(payload.transfer_to_account_id).toBe('acc-456');
  });

  it('builds payload with auto_reconcile action', () => {
    const actions = [{ id: '1', type: 'auto_reconcile' as const, value: 'true' }];
    const payload = buildPayload(baseValues, [], actions);
    expect(payload.actions.auto_reconcile).toBe(true);
  });

  it('does not set auto_reconcile when value is false', () => {
    const actions = [{ id: '1', type: 'auto_reconcile' as const, value: 'false' }];
    const payload = buildPayload(baseValues, [], actions);
    expect(payload.actions.auto_reconcile).toBeUndefined();
  });

  it('builds payload with add_note action', () => {
    const actions = [{ id: '1', type: 'add_note' as const, value: 'Test note' }];
    const payload = buildPayload(baseValues, [], actions);
    expect(payload.actions.add_note).toBe('Test note');
  });

  it('trims note values', () => {
    const actions = [{ id: '1', type: 'add_note' as const, value: '  spaced note  ' }];
    const payload = buildPayload(baseValues, [], actions);
    expect(payload.actions.add_note).toBe('spaced note');
  });
});

describe('CONDITION_TYPE_KEYS', () => {
  it('has all expected keys', () => {
    expect(Object.keys(CONDITION_TYPE_KEYS)).toEqual([
      'raw_text_contains',
      'source',
      'amount_greater_than',
      'amount_less_than',
      'type',
    ]);
  });
});

describe('ACTION_TYPE_KEYS', () => {
  it('has all expected keys', () => {
    expect(Object.keys(ACTION_TYPE_KEYS)).toEqual([
      'set_category',
      'set_type',
      'set_account',
      'transfer_to_account',
      'auto_reconcile',
      'add_note',
    ]);
  });
});
