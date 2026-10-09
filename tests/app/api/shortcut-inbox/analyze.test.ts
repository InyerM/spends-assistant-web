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
    history?: Record<string, unknown>[];
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
        ilike: () => query,
        order: () => query,
        limit: () => query,
        insert: (value: Record<string, unknown>) => {
          inserts.push(value);
          rows.forwarded_email_analyses = value;
          return query;
        },
        update: (value: Record<string, unknown>) => {
          // Migration 20261006000030 permits only review annotations, not captured facts.
          const editable = new Set([
            'analysis_version',
            'suggested_type',
            'description',
            'notes',
            'account_id',
            'category_id',
            'category_source',
          ]);
          if (
            table === 'forwarded_email_analyses' &&
            Object.keys(value).some((field) => !editable.has(field))
          )
            throw new Error('Stored source evidence is immutable');
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
            table === 'transactions'
              ? (options.history ?? [])
              : table === 'accounts'
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

  it.each([false, true])('fills a missing bank time from AI with cached=%s', async (cached) => {
    const db = fakeDb({
      inbox: {
        ...inbox,
        raw_text:
          'From (unverified): alertas@example.test\nPago QR de $15,800 completado el 02/10/2026 a las 16:31.',
      },
      ...(cached
        ? {
            cached: {
              inbox_item_id: id,
              user_id: 'owner-a',
              analysis_version: 2,
              bank_event_at: null,
              suggested_type: 'expense',
            },
          }
        : {}),
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          type: 'expense',
          category_id: null,
          bank_event_at: '2026-10-02T16:31:00-05:00',
        }),
      ),
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(cached ? 200 : 201);
    expect(await response.json()).toMatchObject({ bank_event_at: '2026-10-02T16:31:00-05:00' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(db.updates.every((value) => !('bank_event_at' in value))).toBe(true);
  });

  it('keeps deterministic bank time when the AI returns a conflicting time', async () => {
    const db = fakeDb();
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ type: 'expense', bank_event_at: '2026-10-06T18:00:00-05:00' }),
        ),
    );
    expect(await (await POST(request(), context)).json()).toMatchObject({
      bank_event_at: '2026-10-06T15:42:00-05:00',
    });
  });

  it('rejects an AI clock attached to a different deterministic bank date', async () => {
    const db = fakeDb({
      inbox: {
        ...inbox,
        raw_text:
          'From (unverified): alertas@ayn.notificacionesbancolombia.com\nBancolombia: Pagaste $15,800 desde tu cuenta *1234 el 02/10/2026. Hora operación 16:31.',
      },
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ type: 'expense', bank_event_at: '2026-10-03T16:31:00-05:00' }),
        ),
    );
    expect(await (await POST(request(), context)).json()).toMatchObject({ bank_event_at: null });
  });

  it('keeps a missing cached time empty when the AI is unavailable', async () => {
    const db = fakeDb({
      inbox: { ...inbox, raw_text: 'Pago QR de $15,800 completado el 02/10/2026 a las 16:31.' },
      cached: { inbox_item_id: id, user_id: 'owner-a', analysis_version: 2, bank_event_at: null },
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ error: 'Unavailable' }, { status: 503 })),
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ bank_event_at: null });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['upstream', 'network', 'invalid-json'])(
    'preserves receipt evidence during %s failure without caching incomplete AI output',
    async (failure) => {
      const db = fakeDb({
        inbox: {
          ...inbox,
          raw_text: inbox.raw_text.replace('CEA PRACTICAR DEL EJE', 'EXAMPLE SERVICE'),
        },
      });
      getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
      vi.stubGlobal(
        'fetch',
        failure === 'network'
          ? vi.fn().mockRejectedValue(new Error('network'))
          : vi
              .fn()
              .mockResolvedValue(
                failure === 'invalid-json'
                  ? new Response('broken', { status: 200 })
                  : new Response('', { status: 503 }),
              ),
      );
      const response = await POST(request(), context);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        ai_status: 'unavailable',
        analysis_source: 'evidence',
        merchant: 'EXAMPLE SERVICE',
        amount: 1550000,
        account_id: accountId,
        bank_event_at: '2026-10-06T15:42:00-05:00',
        category_id: null,
      });
      expect(db.inserts).toHaveLength(0);
      expect(db.updates).toHaveLength(0);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json({ type: 'expense', category_id: categoryId })),
      );
      expect((await POST(request(), context)).status).toBe(201);
      expect(db.inserts).toHaveLength(1);
    },
  );

  it.each([true, false])(
    'keeps individually parsed evidence when the notice has no original time (AI available: %s)',
    async (available) => {
      const db = fakeDb({
        inbox: { ...inbox, raw_text: inbox.raw_text.replace('Hora 3:42 p.m.', '') },
      });
      getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
      if (!available)
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
      const response = await POST(request(), context);
      expect(response.status).toBe(available ? 201 : 200);
      expect(await response.json()).toMatchObject({
        status: 'needs_review',
        merchant: 'CEA PRACTICAR DEL EJE',
        amount: 1550000,
        card_last_four: '8456',
        bank_event_at: null,
        account_id: accountId,
      });
    },
  );

  it('derives missing cached source fields without another AI call or mutating stored evidence', async () => {
    const db = fakeDb({
      cached: {
        inbox_item_id: id,
        user_id: 'owner-a',
        analysis_version: 2,
        account_id: accountId,
        amount: null,
        merchant: null,
        bank_event_at: null,
        card_last_four: null,
      },
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      amount: 1550000,
      card_last_four: '8456',
      bank_event_at: '2026-10-06T15:42:00-05:00',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(db.updates.every((patch) => !('amount' in patch) && !('card_last_four' in patch))).toBe(
      true,
    );
    expect(db.calls.some(({ table }) => table === 'transactions')).toBe(false);
  });

  it('returns the original QR payment time when a personalized bank notice is reviewed', async () => {
    const db = fakeDb({
      inbox: {
        ...inbox,
        raw_text:
          'From (unverified): alertas@notificacionesbancolombia.com\n\nBancolombia: ANA MARÍA\nPÉREZ pagaste $15,800.00 por codigo QR desde tu cuenta *1234 a la llave 0001112223 el 02/10/2026 a las 16:31.',
      },
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      amount: 15800,
      bank_event_at: '2026-10-02T16:31:00-05:00',
      card_last_four: '1234',
      category_id: null,
      ai_status: 'unavailable',
    });
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
    expect(db.updates).toContainEqual(expect.objectContaining({ account_id: accountId }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechecks a cached account after its identifiers change without another provider call', async () => {
    const db = fakeDb({
      inbox: {
        ...inbox,
        raw_text:
          'From (unverified): alertas@ayn.notificacionesbancolombia.com\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb **9989',
      },
      cached: {
        inbox_item_id: id,
        user_id: 'owner-a',
        analysis_version: 2,
        account_id: 'stale-account',
      },
      accounts: [
        {
          id: accountId,
          name: 'Bancolombia',
          institution: 'Bancolombia',
          type: 'savings',
          last_four: '2651',
          currency: 'COP',
          is_active: true,
          deleted_at: null,
          identifiers: [
            { kind: 'bank_account', last_four: '2651', is_active: true, is_primary: true },
            { kind: 'debit_card', last_four: '9989', is_active: true, is_primary: false },
          ],
        },
      ],
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ account_id: accountId });
    expect(db.updates).toContainEqual(expect.objectContaining({ account_id: accountId }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reapplies a newly edited category rule to a cached pending suggestion', async () => {
    const db = fakeDb({
      cached: {
        inbox_item_id: id,
        user_id: 'owner-a',
        analysis_version: 2,
        account_id: accountId,
        suggested_type: 'expense',
        category_id: null,
        category_source: null,
        description: 'CEA PRACTICAR DEL EJE',
        amount: 1550000,
      },
      rules: [
        {
          rule_type: 'general',
          is_active: true,
          priority: 100,
          condition_logic: 'or',
          conditions: { description_contains: ['PRACTICAR DEL EJE'] },
          actions: { set_category: categoryId },
        },
      ],
    });
    getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      category_id: categoryId,
      category_source: 'automation',
    });
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

it('applies an active transfer recipient rule and note without requiring an AI call', async () => {
  vi.mocked(fetch).mockClear();
  const db = fakeDb({
    inbox: {
      ...inbox,
      raw_text:
        'From (unverified): alerts@notificacionesbancolombia.com\n\nBancolombia: Transferiste $36,000.00 desde tu cuenta *2651 a la cuenta *3248292427 el 01/10/26 a las 12:46.',
    },
    rules: [
      {
        name: 'Domicilio Almuerzos Liliana',
        rule_type: 'general',
        is_active: true,
        priority: 50,
        condition_logic: 'or',
        conditions: { raw_text_contains: ['*3248292427'] },
        actions: { set_category: categoryId, add_note: 'Domicilio de almuerzos Liliana' },
      },
    ],
  });
  getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
  const response = await POST(request(), context);
  expect(await response.json()).toMatchObject({
    category_id: categoryId,
    category_source: 'automation',
    notes: 'Domicilio de almuerzos Liliana',
    automation_fields: ['categoryId', 'description', 'notes'],
  });
  expect(fetch).not.toHaveBeenCalled();
});

it('suggests consistent recipient history when no rule matches and scopes it to the owner and account', async () => {
  vi.mocked(fetch).mockClear();
  const raw =
    'From (unverified): alerts@notificacionesbancolombia.com\n\nBancolombia: Transferiste $36,000.00 desde tu cuenta *2651 a la cuenta *3248292427 el 01/10/26 a las 12:46.';
  const payment = {
    raw_text: raw,
    category_id: categoryId,
    description: 'Almuerzo Liliana',
    notes: 'Domicilio',
  };
  const db = fakeDb({
    inbox: { ...inbox, raw_text: raw },
    accounts: [
      {
        id: accountId,
        institution: 'Bancolombia',
        name: 'Bancolombia',
        type: 'savings',
        currency: 'COP',
        is_active: true,
        last_four: '2651',
        deleted_at: null,
      },
    ],
    history: [payment, payment],
  });
  getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
  const response = await POST(request(), context);
  expect(await response.json()).toMatchObject({
    category_id: categoryId,
    category_source: 'review_context',
    description: 'Almuerzo Liliana',
    history_fields: ['categoryId', 'description', 'notes'],
  });
  expect(db.calls.find((call) => call.table === 'transactions')?.filters).toEqual(
    expect.arrayContaining([
      ['user_id', 'owner-a'],
      ['account_id', accountId],
    ]),
  );
  expect(fetch).not.toHaveBeenCalled();
});

it('returns parsed card repayment evidence without relying on the unavailable AI service', async () => {
  vi.mocked(fetch).mockClear();
  const db = fakeDb({
    inbox: {
      ...inbox,
      raw_text:
        'From (unverified): alertasynotificaciones@bancolombia.com.co\nBancolombia: Pagaste $123,456 en la tarjeta de credito *1234 desde la cuenta *5678, el 01/10/2026 18:37.',
    },
  });
  getUserClient.mockResolvedValue({ userId: 'owner-a', accessToken: 'test-jwt', supabase: db });
  const response = await POST(request(), context);
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    analysis_source: 'evidence',
    category_id: null,
    status: 'needs_review',
    amount: 123456,
    bank_event_at: '2026-10-01T18:37:00-05:00',
    card_last_four: '1234',
  });
  expect(fetch).not.toHaveBeenCalled();
});
