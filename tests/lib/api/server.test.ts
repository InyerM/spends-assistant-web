import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  jsonResponse,
  errorResponse,
  adjustAccountBalance,
  applyTransactionBalance,
  applyAutomationRules,
} from '@/lib/api/server';
import { createMockAutomationRule } from '@/tests/__test-helpers__/factories';

// Mock the supabase server module
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

describe('jsonResponse', () => {
  it('returns JSON with default 200 status', async () => {
    const response = jsonResponse({ ok: true });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  it('accepts custom status code', async () => {
    const response = jsonResponse({ created: true }, 201);
    expect(response.status).toBe(201);
  });
});

describe('errorResponse', () => {
  it('returns error JSON with default 500 status', async () => {
    const response = errorResponse('Something went wrong');
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'Something went wrong' });
  });

  it('accepts custom status code', async () => {
    const response = errorResponse('Not found', 404);
    expect(response.status).toBe(404);
  });
});

describe('adjustAccountBalance', () => {
  let mockSupabase: ReturnType<typeof createChainableSupabase>;

  function createChainableSupabase(balance: number | null) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ['select', 'eq', 'single', 'update'] as const;
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({
      data: balance !== null ? { balance } : null,
      error: null,
    });
    const from = vi.fn().mockReturnValue(chain);
    return { from, _chain: chain };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adds to account balance', async () => {
    mockSupabase = createChainableSupabase(500000);
    await adjustAccountBalance(mockSupabase as never, 'acc-1', 100000, 'add');
    // update should have been called with new balance
    expect(mockSupabase._chain.update).toHaveBeenCalledWith({ balance: 600000 });
  });

  it('subtracts from account balance', async () => {
    mockSupabase = createChainableSupabase(500000);
    await adjustAccountBalance(mockSupabase as never, 'acc-1', 100000, 'subtract');
    expect(mockSupabase._chain.update).toHaveBeenCalledWith({ balance: 400000 });
  });

  it('does nothing when account not found', async () => {
    mockSupabase = createChainableSupabase(null);
    await adjustAccountBalance(mockSupabase as never, 'acc-1', 100000, 'add');
    expect(mockSupabase._chain.update).not.toHaveBeenCalled();
  });
});

describe('applyTransactionBalance', () => {
  function createChainableSupabase(balance: number) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ['select', 'eq', 'single', 'update'] as const;
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({ data: { balance }, error: null });
    return { from: vi.fn().mockReturnValue(chain), _chain: chain };
  }

  it('subtracts for expense', async () => {
    const sb = createChainableSupabase(1000000);
    await applyTransactionBalance(sb as never, 'expense', 'acc-1', 50000);
    expect(sb._chain.update).toHaveBeenCalledWith({ balance: 950000 });
  });

  it('adds for income', async () => {
    const sb = createChainableSupabase(1000000);
    await applyTransactionBalance(sb as never, 'income', 'acc-1', 50000);
    expect(sb._chain.update).toHaveBeenCalledWith({ balance: 1050000 });
  });

  it('handles transfer (subtract from source, add to dest)', async () => {
    const sb = createChainableSupabase(1000000);
    await applyTransactionBalance(sb as never, 'transfer', 'acc-1', 50000, 'acc-2');
    // Should be called twice (subtract from source, add to dest)
    expect(sb._chain.update).toHaveBeenCalledTimes(2);
  });

  it('reverses expense (adds back)', async () => {
    const sb = createChainableSupabase(950000);
    await applyTransactionBalance(sb as never, 'expense', 'acc-1', 50000, null, true);
    expect(sb._chain.update).toHaveBeenCalledWith({ balance: 1000000 });
  });

  it('reverses income (subtracts)', async () => {
    const sb = createChainableSupabase(1050000);
    await applyTransactionBalance(sb as never, 'income', 'acc-1', 50000, null, true);
    expect(sb._chain.update).toHaveBeenCalledWith({ balance: 1000000 });
  });

  it('does nothing for unknown type', async () => {
    const sb = createChainableSupabase(1000000);
    await applyTransactionBalance(sb as never, 'unknown', 'acc-1', 50000);
    expect(sb._chain.update).not.toHaveBeenCalled();
  });
});

describe('applyAutomationRules', () => {
  function createRulesSupabase(rules: ReturnType<typeof createMockAutomationRule>[]) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ['select', 'eq', 'is', 'order'] as const;
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Make chain thenable for the query result
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: rules, error: null }),
      enumerable: false,
      configurable: true,
    });
    return { from: vi.fn().mockReturnValue(chain), _chain: chain };
  }

  it('applies matching rule actions', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { description_contains: ['restaurante'] },
        actions: { set_type: 'income' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Almuerzo Restaurante',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.type).toBe('income');
  });

  it('returns unchanged transaction when no rules match', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { description_contains: ['uber'] },
        actions: { set_type: 'income' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Almuerzo Restaurante',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.type).toBe('expense');
  });

  it('returns transaction when no rules exist', async () => {
    const sb = createRulesSupabase([]);
    const tx = {
      description: 'Test',
      amount: 100,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.type).toBe('expense');
  });

  it('matches description_regex', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { description_regex: '^Nomina.*' },
        actions: { set_type: 'income' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Nomina Enero',
      amount: 3000000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.type).toBe('income');
  });

  it('matches amount_between', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { amount_between: [10000, 100000] },
        actions: { set_category: 'medium-expense' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.category_id).toBe('medium-expense');
  });

  it('matches amount_equals', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { amount_equals: 50000 },
        actions: { add_note: 'exact' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.notes).toBe('exact');
  });

  it('matches from_account', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { from_account: 'acc-1' },
        actions: { set_type: 'transfer' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.type).toBe('transfer');
  });

  it('matches raw_text_contains', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { raw_text_contains: ['bancolombia'] },
        actions: { add_note: 'bank detected' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
      raw_text: 'Bancolombia: Compraste',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.notes).toBe('bank detected');
  });

  it('matches source condition', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: { source: ['bancolombia_email'] },
        actions: { add_note: 'from email' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'bancolombia_email',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.notes).toBe('from email');
  });

  it('applies set_account action', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: {},
        actions: { set_account: 'acc-new' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.account_id).toBe('acc-new');
  });

  it('applies link_to_account action with transfer_id', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: {},
        actions: { link_to_account: 'acc-dest' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.transfer_to_account_id).toBe('acc-dest');
    expect(result.transfer_id).toBeDefined();
  });

  it('injects transfer_to_account_id from rule', async () => {
    const rules = [
      createMockAutomationRule({
        conditions: {},
        actions: { set_type: 'transfer' },
        transfer_to_account_id: 'acc-transfer',
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.transfer_to_account_id).toBe('acc-transfer');
  });

  it('tracks applied rules', async () => {
    const rules = [
      createMockAutomationRule({
        id: 'rule-1',
        name: 'Test Rule',
        conditions: {},
        actions: { set_type: 'income' },
      }),
    ];
    const sb = createRulesSupabase(rules);
    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.applied_rules).toHaveLength(1);
    expect((result.applied_rules as Array<{ rule_id: string }>)[0].rule_id).toBe('rule-1');
  });

  it('returns unchanged transaction when rules data is null', async () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    ['select', 'eq', 'is', 'order'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
      enumerable: false,
      configurable: true,
    });
    const sb = { from: vi.fn().mockReturnValue(chain) };

    const tx = {
      description: 'Test',
      amount: 50000,
      account_id: 'acc-1',
      source: 'api',
      type: 'expense',
    };
    const result = await applyAutomationRules(sb as never, tx);
    expect(result.type).toBe('expense');
  });
});
