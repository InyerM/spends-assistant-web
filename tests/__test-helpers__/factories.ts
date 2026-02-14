import { vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Transaction, Account, Category, AutomationRule } from '@/types';

export function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    user_id: 'test-user-id',
    date: '2024-01-15',
    time: '14:30',
    amount: 50000,
    description: 'Almuerzo restaurante',
    notes: null,
    category_id: 'cat-1',
    account_id: 'acc-1',
    type: 'expense',
    payment_method: 'debit_card',
    source: 'api',
    confidence: 95,
    transfer_to_account_id: null,
    transfer_id: null,
    is_reconciled: false,
    reconciled_at: null,
    reconciliation_id: null,
    raw_text: 'Compraste $50,000 en restaurante',
    parsed_data: null,
    applied_rules: null,
    duplicate_status: null,
    duplicate_of: null,
    deleted_at: null,
    created_at: '2024-01-15T19:30:00Z',
    updated_at: '2024-01-15T19:30:00Z',
    ...overrides,
  };
}

export function createMockAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1',
    user_id: 'test-user-id',
    name: 'Bancolombia Savings',
    type: 'savings',
    institution: 'bancolombia',
    last_four: '2651',
    currency: 'COP',
    balance: 1000000,
    is_active: true,
    color: null,
    icon: null,
    deleted_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    user_id: 'test-user-id',
    name: 'Food',
    slug: 'food',
    type: 'expense',
    parent_id: null,
    icon: null,
    color: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockAutomationRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: 'rule-1',
    user_id: 'test-user-id',
    name: 'Test Rule',
    is_active: true,
    priority: 1,
    prompt_text: null,
    match_phone: null,
    transfer_to_account_id: null,
    conditions: {},
    actions: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

interface ChainableQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

export function createMockSupabase(
  data: unknown = null,
  error: { message: string } | null = null,
): {
  from: ReturnType<typeof vi.fn>;
  _chain: ChainableQuery;
} {
  const result = { data, error, count: Array.isArray(data) ? data.length : 0 };
  const chain: ChainableQuery = {} as ChainableQuery;

  const methods = [
    'select',
    'eq',
    'is',
    'in',
    'gte',
    'lte',
    'ilike',
    'order',
    'range',
    'limit',
    'insert',
    'update',
    'delete',
  ] as const;

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);

  // Make the chain itself thenable (for queries that don't call .single())
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: typeof result) => void) => resolve(result),
    enumerable: false,
  });

  const from = vi.fn().mockReturnValue(chain);

  return { from, _chain: chain };
}

export function createQueryWrapper(): React.FC<{ children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}
