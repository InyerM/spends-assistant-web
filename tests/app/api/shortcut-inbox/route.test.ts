import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, GET } from '@/app/api/shortcut-inbox/route';
import { AuthError } from '@/lib/api/server';

const { getShortcutPostClient, getUserClient } = vi.hoisted(() => ({
  getShortcutPostClient: vi.fn(),
  getUserClient: vi.fn(),
}));

vi.mock('@/lib/shortcut-inbox/auth', () => ({ getShortcutPostClient }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

function request(body: unknown): Request {
  return new Request('https://example.test/api/shortcut-inbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer sk_synthetic' },
    body: JSON.stringify(body),
  });
}

function fakeDatabase() {
  const rows: Record<string, unknown>[] = [];
  const filters: [string, unknown][] = [];
  const supabase = {
    from(table: string) {
      expect(table).toBe('shortcut_inbox_items');
      return {
        insert(row: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  if (
                    rows.some(
                      (existing) =>
                        existing.user_id === row.user_id &&
                        existing.idempotency_key === row.idempotency_key,
                    )
                  ) {
                    return { data: null, error: { code: '23505' } };
                  }
                  const stored = { ...row, id: `inbox-${rows.length + 1}`, status: 'pending' };
                  rows.push(stored);
                  return { data: stored, error: null };
                },
              };
            },
          };
        },
        select() {
          const query = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return query;
            },
            async maybeSingle() {
              return {
                data:
                  rows.find((row) => filters.every(([column, value]) => row[column] === value)) ??
                  null,
                error: null,
              };
            },
            order() {
              return query;
            },
            range() {
              return Promise.resolve({
                data: rows.filter((row) =>
                  filters.every(([column, value]) => row[column] === value),
                ),
                count: rows.length,
                error: null,
              });
            },
          };
          return query;
        },
      };
    },
  };
  return { supabase, rows, filters };
}

describe('/api/shortcut-inbox', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the authenticated owner, ignoring a spoofed user_id in JSON', async () => {
    const db = fakeDatabase();
    getShortcutPostClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const response = await POST(
      request({
        user_id: 'owner-b',
        source: 'sms-shortcut',
        items: [
          {
            external_id: 'm-1',
            received_at: '2026-09-29T10:00:00Z',
            raw_text: 'Synthetic payment',
          },
        ],
      }) as never,
    );
    expect(response.status).toBe(201);
    expect(db.rows[0].user_id).toBe('owner-a');
    expect(JSON.stringify(await response.json())).not.toContain('Synthetic payment');
  });

  it('returns a per-item result when one item is invalid', async () => {
    const db = fakeDatabase();
    getShortcutPostClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const response = await POST(
      request({
        source: 'sms-shortcut',
        items: [
          { received_at: '2026-09-29T10:00:00Z', raw_text: 'Synthetic payment' },
          { received_at: 'invalid', raw_text: 'Another synthetic payment' },
        ],
      }) as never,
    );
    expect(response.status).toBe(207);
    expect((await response.json()).items.map((row: { status: string }) => row.status)).toEqual([
      'received',
      'invalid',
    ]);
    expect(db.rows).toHaveLength(1);
  });

  it('returns the original inbox ID when an API-key batch is replayed', async () => {
    const db = fakeDatabase();
    getShortcutPostClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const body = {
      source: 'sms-shortcut',
      items: [
        { external_id: 'm-1', received_at: '2026-09-29T10:00:00Z', raw_text: 'Synthetic payment' },
      ],
    };
    const first = await POST(request(body) as never);
    const second = await POST(request(body) as never);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect((await second.json()).items[0]).toMatchObject({
      status: 'previously_received',
      id: 'inbox-1',
    });
    expect(db.filters).toContainEqual(['user_id', 'owner-a']);
    expect(db.rows).toHaveLength(1);
  });

  it('rejects an unauthorized request without storing text', async () => {
    const db = fakeDatabase();
    getShortcutPostClient.mockRejectedValue(new AuthError());
    const response = await POST(request({ source: 'sms-shortcut', items: [] }) as never);
    expect(response.status).toBe(401);
    expect(db.rows).toHaveLength(0);
  });

  it('lists only the cookie-authenticated owner and does not use an API key', async () => {
    const db = fakeDatabase();
    getUserClient.mockResolvedValue({ supabase: db.supabase, userId: 'owner-a' });
    const response = await GET(new Request('https://example.test/api/shortcut-inbox') as never);
    expect(response.status).toBe(200);
    expect(db.filters).toContainEqual(['user_id', 'owner-a']);
    expect(getShortcutPostClient).not.toHaveBeenCalled();
  });
});
