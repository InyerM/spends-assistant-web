import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createAccount } from '@/app/api/accounts/route';
import { POST as createCategory } from '@/app/api/categories/route';
import { POST as createAutomation } from '@/app/api/automation-rules/route';

vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

type Resource = 'accounts' | 'categories' | 'automation_rules';

async function postWithPlan(resource: Resource, plan: string, status: string): Promise<Response> {
  const { getUserClient } = await import('@/lib/api/server');
  const from = vi.fn((table: string) => {
    const filters: [string, unknown][] = [];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push([column, value]);
        return query;
      }),
      is: vi.fn(() => query),
      insert: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data:
          table === 'subscriptions'
            ? { plan, status }
            : table === 'app_settings'
              ? { value: resource === 'automation_rules' ? 2 : 1 }
              : null,
      })),
      single: vi.fn(async () => ({ data: { id: 'created' }, error: null })),
      then: (resolve: (result: { count: number }) => void) => {
        const count =
          table === 'automation_rules'
            ? 2
            : filters.some(([column, value]) => column === 'is_default' && value === false)
              ? 0
              : 86;
        resolve({ count });
      },
    };
    return query;
  });
  vi.mocked(getUserClient).mockResolvedValue({ supabase: { from } as never, userId: 'owner' });

  const bodies: Record<Resource, Record<string, string>> = {
    accounts: { name: 'Savings', type: 'savings' },
    categories: { name: 'Groceries' },
    automation_rules: { name: 'Groceries rule' },
  };
  const handlers = {
    accounts: createAccount,
    categories: createCategory,
    automation_rules: createAutomation,
  };
  return handlers[resource](
    new NextRequest(`http://localhost/api/${resource}`, {
      method: 'POST',
      body: JSON.stringify(bodies[resource]),
    }),
  );
}

describe('web creation limits', () => {
  it('allows the first custom account when only default accounts exist', async () => {
    expect((await postWithPlan('accounts', 'free', 'active')).status).toBe(201);
  });

  it('allows the first custom category when only default categories exist', async () => {
    expect((await postWithPlan('categories', 'free', 'active')).status).toBe(201);
  });

  it('applies free automation limits to canceled Pro access', async () => {
    expect((await postWithPlan('automation_rules', 'pro', 'canceled')).status).toBe(403);
  });
});
