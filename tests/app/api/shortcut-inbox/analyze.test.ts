import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/shortcut-inbox/[id]/analyze/route';

const { getUserClient } = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.example' } }));

const id = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const categoryId = '33333333-3333-4333-8333-333333333333';
const context = { params: Promise.resolve({ id }) };
const request = (): Request =>
  new Request(`https://example.test/api/shortcut-inbox/${id}/analyze`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test-jwt' },
  });
const inbox = {
  id,
  user_id: 'owner-a',
  source: 'forwarded_email',
  status: 'pending',
  received_at: '2026-10-06T20:42:35Z',
  raw_text: [
    'From (unverified): notificaciones@lulobank.com',
    '',
    'Compra realizada',
    '',
    '                    Realizaste una compra en CEA PRACTICAR DEL EJE por $1,550,000',
    'Origen tarjeta de crédito •8456',
    'Fecha 6 de octubre de 2026',
    'Hora 3:42 p.m.',
  ].join('\n'),
};

function fakeDb(
  options: {
    inbox?: typeof inbox | null;
    verified?: boolean;
    cached?: Record<string, unknown>;
    accounts?: Record<string, unknown>[];
    rules?: Record<string, unknown>[];
  } = {},
) {
  const rows: Record<string, unknown> = {
    shortcut_inbox_items: options.inbox === undefined ? inbox : options.inbox,
    email_forwarding_routes:
      options.verified === false
        ? null
        : {
            confirmation_received_at: '2026-10-03T00:00:00Z',
            user_confirmed_at: '2026-10-03T00:00:00Z',
          },
    forwarded_email_analyses: options.cached ?? null,
    categories: { id: categoryId },
  };
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  return {
    calls,
    inserts,
    updates,
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      calls.push({ table, filters });
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          filters.push([field, value]);
          return query;
        },
        is: (field: string, value: unknown) => {
          filters.push([field, value]);
          return query;
        },
        insert: (value: Record<string, unknown>) => {
          inserts.push(value);
          rows.forwarded_email_analyses = value;
          return query;
        },
        update: (value: Record<string, unknown>) => {
          updates.push(value);
          rows.forwarded_email_analyses = {
            ...(rows.forwarded_email_analyses as object),
            ...value,
          };
          return query;
        },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        then(resolve: (value: unknown) => unknown) {
          const data =
            table === 'accounts'
              ? (options.accounts ?? [
                  {
                    id: accountId,
                    name: 'Lulo card',
                    institution: 'Lulobank',
                    type: 'credit_card',
                    last_four: '8456',
                    currency: 'COP',
                    is_active: true,
                    deleted_at: null,
                  },
                ])
              : table === 'automation_rules'
                ? (options.rules ?? [])
                : table === 'categories'
                  ? [{ id: categoryId, slug: 'education', type: 'expense', is_active: true }]
                  : rows[table];
          return Promise.resolve(resolve({ data, error: null }));
        },
      };
      return query;
    },
  };
}

describe('POST forwarded email analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          type: 'expense',
          category_id: categoryId,
          category_source: 'ai',
          description: 'Driving course at CEA Practicar del Eje',
          notes: 'Credit card ending in 8456.',
        }),
      ),
    );
  });

  it('persists a reviewed proposal once and replays it without another provider call', async () => {
    const db = fakeDb();
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    const first = await POST(request() as never, context);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({
      status: 'parsed',
      merchant: 'CEA PRACTICAR DEL EJE',
      amount: 1550000,
      card_last_four: '8456',
      account_id: accountId,
      category_id: categoryId,
      description: 'Driving course at CEA Practicar del Eje',
      notes: 'Credit card ending in 8456.',
    });
    expect(db.inserts).toHaveLength(1);
    expect(db.calls.some(({ table }) => table === 'transactions')).toBe(false);
    expect(
      db.calls.filter(({ table }) => table === 'shortcut_inbox_items')[0].filters,
    ).toContainEqual(['user_id', 'owner-a']);
    const replay = await POST(request() as never, context);
    expect(replay.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(db.inserts).toHaveLength(1);
  });

  it('enriches an older proposal without creating a second analysis row', async () => {
    const db = fakeDb({ cached: { inbox_item_id: id, user_id: 'owner-a', analysis_version: 1 } });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    const response = await POST(request() as never, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      analysis_version: 2,
      category_id: categoryId,
      description: 'Driving course at CEA Practicar del Eje',
    });
    expect(db.inserts).toHaveLength(0);
    expect(db.updates).toHaveLength(1);
  });

  it('repairs a cached account proposal using an active suffix rule without another AI call', async () => {
    const db = fakeDb({
      inbox: {
        ...inbox,
        raw_text:
          'From (unverified): alertas@ayn.notificacionesbancolombia.com\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb **9989',
      },
      cached: { inbox_item_id: id, user_id: 'owner-a', analysis_version: 2, account_id: null },
      accounts: [
        {
          id: accountId,
          name: 'Bancolombia',
          institution: 'bancolombia',
          type: 'savings',
          last_four: '7799',
          bank_account_last_four: '2651',
          currency: 'COP',
          is_active: true,
          deleted_at: null,
        },
      ],
      rules: [
        {
          rule_type: 'account_detection',
          is_active: true,
          condition_logic: 'or',
          conditions: { raw_text_contains: ['7799', '2651', '9989'] },
          actions: { set_account: accountId },
        },
      ],
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ account_id: accountId });
    expect(db.updates).toContainEqual({ account_id: accountId });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a foreign item or unverified forwarding before provider calls', async () => {
    for (const options of [{ inbox: null }, { verified: false }]) {
      const db = fakeDb(options);
      getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
      const response = await POST(request() as never, context);
      expect(response.status).toBe(options.inbox === null ? 404 : 403);
      expect(db.inserts).toHaveLength(0);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('prefills a category and readable copy for a non-Lulo forwarded purchase', async () => {
    const db = fakeDb({
      inbox: {
        ...inbox,
        raw_text:
          'From (unverified): alertas@an.notificacionesbancolombia.com\n\nCompra\n\nBancolombia: Compraste $62.000 en BOLD SA KROKAN P con tu T.Deb *7799',
      },
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    const response = await POST(request() as never, context);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      status: 'needs_review',
      category_id: categoryId,
      category_source: 'ai',
      description: 'Driving course at CEA Practicar del Eje',
      notes: 'Credit card ending in 8456.',
    });
    expect(db.calls.some(({ table }) => table === 'transactions')).toBe(false);
  });

  it('keeps an uncertain category empty without a financial write', async () => {
    const db = fakeDb();
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ type: 'expense', category_id: null, description: null, notes: null }),
        ),
    );
    const response = await POST(request() as never, context);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      status: 'parsed',
      merchant: 'CEA PRACTICAR DEL EJE',
      category_id: null,
    });
    expect(db.calls.some(({ table }) => table === 'transactions')).toBe(false);
  });

  it('leaves email pending when AI consent is required', async () => {
    const db = fakeDb();
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { code: 'AI_CONSENT_REQUIRED', scope: 'forwarded_email', version: 'external-ai-v1' },
            { status: 428 },
          ),
        ),
    );
    const response = await POST(request() as never, context);
    expect(response.status).toBe(428);
    expect(db.inserts).toHaveLength(0);
  });

  it('keeps other bank formats in review without inventing a card suffix', async () => {
    const db = fakeDb({
      inbox: {
        ...inbox,
        raw_text: 'From (unverified): alerts@example-bank.test\n\nPayment notice\n\nPaid $100',
      },
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ type: null, category_id: null, description: null, notes: null }),
        ),
    );
    const response = await POST(request() as never, context);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      status: 'needs_review',
      card_last_four: null,
      category_id: null,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
