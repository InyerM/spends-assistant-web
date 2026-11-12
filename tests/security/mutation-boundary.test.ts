import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createAccount } from '@/app/api/accounts/route';
import { POST as adjustBalance } from '@/app/api/accounts/[id]/balance/route';
import { POST as createRule } from '@/app/api/automation-rules/route';
import { POST as uploadDocument } from '@/app/api/documents/route';
import { POST as inspectDocument } from '@/app/api/documents/[id]/inspect/route';
import { PUT as updateLanguage } from '@/app/api/settings/language/route';
import {
  PATCH as updateInvestment,
  DELETE as deleteInvestment,
} from '@/app/api/investments/[id]/route';
import { POST as forwarding } from '@/app/api/email-forwarding/route';
import { POST as shortcutIntake } from '@/app/api/shortcut-inbox/route';

const { createClient, createAdminClient, from, rpc, sign, fetchMock } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  sign: vi.fn(),
  fetchMock: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient, createAdminClient }));
vi.mock('@/lib/config', () => ({
  workerConfig: { url: 'https://worker.example.test', apiKey: '' },
}));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://database.example.test',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-test-anon',
    NODE_ENV: 'test',
  },
}));
const id = '00000000-0000-4000-8000-000000000001';
const context = { params: Promise.resolve({ id }) };
const routes: Array<[string, string, (request: NextRequest) => Promise<Response>]> = [
  ['/api/accounts', 'POST', createAccount],
  [`/api/accounts/${id}/balance`, 'POST', (request) => adjustBalance(request, context)],
  ['/api/automation-rules', 'POST', createRule],
  ['/api/documents', 'POST', uploadDocument],
  [`/api/documents/${id}/inspect`, 'POST', (request) => inspectDocument(request, context)],
  ['/api/settings/language', 'PUT', updateLanguage],
  [`/api/investments/${id}`, 'PATCH', (request) => updateInvestment(request, context)],
  [`/api/investments/${id}`, 'DELETE', (request) => deleteInvestment(request, context)],
  ['/api/email-forwarding', 'POST', forwarding],
  ['/api/shortcut-inbox', 'POST', shortcutIntake],
];
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'synthetic-owner' } } }),
      getSession: vi.fn(),
    },
    from,
    rpc,
    storage: { from: sign },
  });
});
describe('real route cookie mutation boundary', () => {
  it.each(routes)(
    'rejects foreign cookies before mutation or provider work: %s %s',
    async (pathname, method, invoke) => {
      const response = await invoke(
        new NextRequest('https://app.example.test' + pathname, {
          method,
          headers: { Origin: 'https://sibling.example.test', 'Content-Type': 'application/json' },
          body: method === 'DELETE' ? undefined : JSON.stringify({ action: 'archive' }),
        }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Invalid request origin' });
      expect(createClient).not.toHaveBeenCalled();
      expect(createAdminClient).not.toHaveBeenCalled();
      expect(from).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it('returns 403 before side effects for every exported unsafe route', async () => {
    const modules = import.meta.glob('/app/api/**/route.ts');
    const checked: string[] = [];
    const unexpected: string[] = [];
    for (const [file, load] of Object.entries(modules)) {
      const exports = (await load()) as Record<string, unknown>;
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        if (typeof exports[method] !== 'function') continue;
        const pathname = file
          .replace(/^\/app/u, '')
          .replace(/\/route\.ts$/u, '')
          .replace(/\[[^\]]+\]/gu, id);
        const payload =
          pathname === '/api/budgets'
            ? { month: '2026-11-01', category_id: id, limit_cop: 1, budget_id: id }
            : pathname === '/api/wealth-links'
              ? { kind: 'investment_trade', event_id: id, transaction_id: null, reviewed: true }
              : pathname.includes('/observations/') && method === 'PATCH'
                ? {
                    amount: 1,
                    currency: 'COP',
                    occurred_at_text: null,
                    description: 'Synthetic correction',
                  }
                : pathname === `/api/documents/${id}` && method === 'PATCH'
                  ? { archived: true }
                  : { action: 'archive' };
        const invoke = exports[method] as (
          request: NextRequest,
          context: { params: Promise<{ id: string; observationId: string }> },
        ) => Promise<Response>;
        const response = await invoke(
          new NextRequest('https://app.example.test' + pathname, {
            method,
            headers: { Origin: 'https://sibling.example.test', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
          { params: Promise.resolve({ id, observationId: id }) },
        );
        if (response.status !== 403)
          unexpected.push(method + ' ' + pathname + ': ' + response.status);
        checked.push(method + ' ' + pathname);
      }
    }
    expect(checked).toHaveLength(82);
    expect(unexpected).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
