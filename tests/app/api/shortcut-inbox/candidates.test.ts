import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/shortcut-inbox/[id]/candidates/route';
import { AuthError } from '@/lib/api/server';

const { getUserClient } = vi.hoisted(() => ({ getUserClient: vi.fn() }));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const inboxId = '11111111-1111-4111-8111-111111111111';
const rawText =
  'Bancolombia: Compraste $119.000,00 en Synthetic Store con tu T.Deb *1234, el 23/11/2024';
const context = { params: Promise.resolve({ id: inboxId }) };

type Row = Record<string, unknown>;

function fakeDatabase(
  options: {
    inbox?: Row[];
    accounts?: Row[];
    transactions?: Row[];
    failTransactions?: boolean;
    failInbox?: boolean;
  } = {},
) {
  const rows: Record<string, Row[]> = {
    shortcut_inbox_items: options.inbox ?? [{ id: inboxId, user_id: 'owner-a', raw_text: rawText }],
    accounts: options.accounts ?? [
      { id: 'account-a', user_id: 'owner-a', last_four: '1234', deleted_at: null },
      { id: 'account-b', user_id: 'owner-b', last_four: '1234', deleted_at: null },
    ],
    transactions: options.transactions ?? [
      {
        id: 'tx-exact',
        user_id: 'owner-a',
        date: '2024-11-23',
        amount: 119000,
        account_id: 'account-a',
        raw_text: rawText,
        description: 'Synthetic Store',
        type: 'expense',
        source: 'sms-shortcut',
        deleted_at: null,
      },
      {
        id: 'tx-other-payment',
        user_id: 'owner-a',
        date: '2024-11-23',
        amount: 119000,
        account_id: 'account-a',
        raw_text: 'Different message',
        description: 'Another synthetic purchase',
        type: 'expense',
        source: 'web',
        deleted_at: null,
      },
      {
        id: 'tx-other-owner',
        user_id: 'owner-b',
        date: '2024-11-23',
        amount: 119000,
        account_id: 'account-b',
        raw_text: rawText,
        description: 'Private other user',
        type: 'expense',
        source: 'web',
        deleted_at: null,
      },
      {
        id: 'tx-deleted',
        user_id: 'owner-a',
        date: '2024-11-23',
        amount: 119000,
        account_id: 'account-a',
        raw_text: rawText,
        description: 'Deleted row',
        type: 'expense',
        source: 'web',
        deleted_at: '2026-01-01',
      },
    ],
  };
  const calls: Array<{ table: string; filters: Array<[string, unknown]>; limit?: number }> = [];
  const supabase = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const call = { table, filters, limit: undefined as number | undefined };
      calls.push(call);
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        is(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        limit(value: number) {
          call.limit = value;
          return query;
        },
        async single() {
          const result = evaluate();
          return {
            data: result.data[0] ?? null,
            error: result.error ?? (result.data.length ? null : { code: 'PGRST116' }),
          };
        },
        then(resolve: (value: { data: Row[]; error: { code: string } | null }) => void) {
          resolve(evaluate());
        },
      };
      function evaluate(): { data: Row[]; error: { code: string } | null } {
        if (table === 'transactions' && options.failTransactions)
          return { data: [], error: { code: 'synthetic_failure' } };
        if (table === 'shortcut_inbox_items' && options.failInbox)
          return { data: [], error: { code: 'synthetic_failure' } };
        return {
          data: (rows[table] ?? [])
            .filter((row) => filters.every(([column, value]) => row[column] === value))
            .slice(0, call.limit),
          error: null,
        };
      }
      return query;
    },
  };
  return { supabase, calls };
}

function request(): Request {
  return new Request(`https://example.test/api/shortcut-inbox/${inboxId}/candidates`);
}

describe('GET Shortcut inbox candidates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes each lookup to the owner and presents graded suggestions without confirmation', async () => {
    const db = fakeDatabase();
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const response = await GET(request() as never, context);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.candidates.map((candidate: { id: string }) => candidate.id)).toEqual([
      'tx-exact',
      'tx-other-payment',
    ]);
    expect(body.candidates[0]).toMatchObject({
      strength: 'strong',
      signals: ['exact_raw_text', 'same_amount_date_account'],
    });
    expect(body.candidates[1]).toMatchObject({
      strength: 'possible',
      signals: ['same_amount_date_account'],
    });
    expect(body.evidence).toMatchObject({
      amount: '119000.00',
      date: '2024-11-23',
      account: 'unique',
    });
    expect(JSON.stringify(body)).not.toContain('tx-other-owner');
    expect(JSON.stringify(body)).not.toContain('confirmed');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(
      db.calls.every((call) =>
        call.filters.some(([column, value]) => column === 'user_id' && value === 'owner-a'),
      ),
    ).toBe(true);
    expect(
      db.calls.filter((call) => call.table === 'transactions').every((call) => call.limit === 10),
    ).toBe(true);
  });

  it('skips the amount/date/account query when the account suffix is absent', async () => {
    const db = fakeDatabase({
      inbox: [
        { id: inboxId, user_id: 'owner-a', raw_text: 'Nequi: Pagaste $119.000 el 23/11/2024' },
      ],
    });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const body = await (await GET(request() as never, context)).json();
    expect(body.evidence.account).toBe('unavailable');
    expect(db.calls.filter((call) => call.table === 'transactions')).toHaveLength(1);
    expect(db.calls.some((call) => call.table === 'accounts')).toBe(false);
  });

  it('suggests an owned same-card purchase for a structured Lulo email without matching it automatically', async () => {
    const luloText = [
      'From: Lulo alerts <notificaciones@lulobank.com>',
      'Subject: Compra realizada',
      '',
      'Realizaste una compra en Example Network por $492,041.3',
      'Origen tarjeta de crédito •8456',
      'Fecha 25 de septiembre de 2026',
      'Hora 7:18 p.m.',
    ].join('\n');
    const db = fakeDatabase({
      inbox: [
        {
          id: inboxId,
          user_id: 'owner-a',
          source: 'lulo-email-backfill',
          received_at: '2026-09-26T01:20:00Z',
          raw_text: luloText,
        },
      ],
      accounts: [{ id: 'lulo-card', user_id: 'owner-a', last_four: '8456', deleted_at: null }],
      transactions: [
        {
          id: 'tx-card',
          user_id: 'owner-a',
          date: '2026-09-25',
          amount: 492041.3,
          account_id: 'lulo-card',
          raw_text: 'Different notice',
          description: 'Example Network',
          type: 'expense',
          source: 'web',
          deleted_at: null,
        },
      ],
    });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const body = await (await GET(request() as never, context)).json();
    expect(body.evidence).toMatchObject({
      amount: '492041.30',
      date: '2026-09-25',
      account: 'unique',
    });
    expect(body.candidates).toMatchObject([
      { id: 'tx-card', strength: 'possible', signals: ['same_amount_date_account'] },
    ]);
    expect(
      db.calls.every((call) =>
        call.filters.some(([column, value]) => column === 'user_id' && value === 'owner-a'),
      ),
    ).toBe(true);
  });

  it('never tuple-matches a zero-amount Lulo notice', async () => {
    const luloText = [
      'From: Lulo alerts <notificaciones@lulobank.com>',
      'Subject: Compra realizada',
      '',
      'Realizaste una compra en Demo Store por $0',
      'Origen tarjeta de crédito •8456',
      'Fecha 25 de septiembre de 2026',
      'Hora 7:17 p.m.',
    ].join('\n');
    const db = fakeDatabase({
      inbox: [
        {
          id: inboxId,
          user_id: 'owner-a',
          source: 'lulo-email-backfill',
          received_at: '2026-09-26T01:20:00Z',
          raw_text: luloText,
        },
      ],
    });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const body = await (await GET(request() as never, context)).json();
    expect(body.evidence.amount).toBeNull();
    expect(db.calls.some((call) => call.table === 'accounts')).toBe(false);
    expect(db.calls.filter((call) => call.table === 'transactions')).toHaveLength(1);
  });

  it('withholds tuple suggestions when a masked suffix maps to multiple owned accounts', async () => {
    const db = fakeDatabase({
      accounts: [
        { id: 'account-a', user_id: 'owner-a', last_four: '1234', deleted_at: null },
        { id: 'account-c', user_id: 'owner-a', last_four: '1234', deleted_at: null },
      ],
    });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const body = await (await GET(request() as never, context)).json();
    expect(body.evidence.account).toBe('ambiguous');
    expect(db.calls.filter((call) => call.table === 'transactions')).toHaveLength(1);
  });

  it('never scans a broad transaction window for an informational message', async () => {
    const db = fakeDatabase({
      inbox: [
        { id: inboxId, user_id: 'owner-a', raw_text: 'Saldo disponible $119.000 al 23/11/2024' },
      ],
    });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const body = await (await GET(request() as never, context)).json();
    expect(body.evidence.amount).toBeNull();
    expect(db.calls.filter((call) => call.table === 'transactions')).toHaveLength(1);
  });

  it('caps the response even when many exact-text rows exist', async () => {
    const transactions = Array.from({ length: 20 }, (_, index) => ({
      id: `tx-${index}`,
      user_id: 'owner-a',
      date: '2024-11-23',
      amount: 119000,
      account_id: 'account-a',
      raw_text: rawText,
      description: 'Synthetic',
      type: 'expense',
      source: 'sms-shortcut',
      deleted_at: null,
    }));
    const db = fakeDatabase({ transactions });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const body = await (await GET(request() as never, context)).json();
    expect(body.candidates).toHaveLength(10);
    expect(body.at_limit).toBe(true);
  });

  it('returns 404 for another owner inbox item without querying transactions', async () => {
    const db = fakeDatabase({ inbox: [{ id: inboxId, user_id: 'owner-b', raw_text: rawText }] });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const response = await GET(request() as never, context);
    expect(response.status).toBe(404);
    expect(db.calls.some((call) => call.table === 'transactions')).toBe(false);
  });

  it('returns an error rather than false reassurance when a transaction lookup fails', async () => {
    const db = fakeDatabase({ failTransactions: true });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    expect((await GET(request() as never, context)).status).toBe(500);
  });

  it('returns a server error when the owned inbox lookup fails', async () => {
    const db = fakeDatabase({ failInbox: true });
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    expect((await GET(request() as never, context)).status).toBe(500);
  });

  it('rejects missing authentication', async () => {
    getUserClient.mockRejectedValue(new AuthError());
    expect((await GET(request() as never, context)).status).toBe(401);
  });
});
