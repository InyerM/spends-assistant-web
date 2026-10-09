import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/transactions/[id]/origin/route';
import { AuthError, getUserClient } from '@/lib/api/server';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class AuthError extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
const id = '11111111-1111-4111-8111-111111111111';
const doc = '22222222-2222-4222-8222-222222222222';
const inbox = '33333333-3333-4333-8333-333333333333';
const context = { params: Promise.resolve({ id }) };
const request = new Request(`http://localhost/api/transactions/${id}/origin`);
let tables: Record<string, unknown>;
let queries: Array<{ table: string; eq: ReturnType<typeof vi.fn> }>;
beforeEach(() => {
  tables = {
    transactions: { id, parsed_data: { document_id: doc } },
    document_observations: null,
    documents: { id: doc, file_name: 'Synthetic receipt.pdf', source_inbox_item_id: inbox },
    shortcut_inbox_match_decisions: null,
    shortcut_inbox_items: {
      id: inbox,
      source: 'forwarded_email',
      raw_text: 'Synthetic email',
      received_at: '2026-10-08T12:00:00Z',
    },
  };
  queries = [];
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: tables[table], error: null })),
    };
    for (const method of ['select', 'eq', 'is', 'limit'] as const)
      chain[method].mockReturnValue(chain);
    queries.push({ table, eq: chain.eq });
    return chain;
  });
  vi.mocked(getUserClient).mockResolvedValue({ userId: 'owner', supabase: { from } as never });
});
describe('transaction original evidence', () => {
  it('returns the original document and attachment email with owner filters on every lookup', async () => {
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      document: tables.documents,
      inbox: tables.shortcut_inbox_items,
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    for (const query of queries) expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
  });
  it('returns no document when the parsed ID points outside the owner scope', async () => {
    tables.documents = null;
    const response = await GET(request, context);
    expect(await response.json()).toEqual({ document: null, inbox: null });
  });
  it('does not read any evidence for an inaccessible transaction', async () => {
    tables.transactions = null;
    expect((await GET(request, context)).status).toBe(404);
    expect(queries.map((q) => q.table)).toEqual(['transactions']);
  });
  it('loads an active received email match and ignores a reversed match', async () => {
    tables.transactions = { id, parsed_data: null };
    tables.shortcut_inbox_match_decisions = {
      inbox_item_id: inbox,
      shortcut_inbox_match_reversals: [],
    };
    expect(await (await GET(request, context)).json()).toEqual({
      document: null,
      inbox: tables.shortcut_inbox_items,
    });
    tables.shortcut_inbox_match_decisions = {
      inbox_item_id: inbox,
      shortcut_inbox_match_reversals: [{ decision_id: 'reversed' }],
    };
    expect(await (await GET(request, context)).json()).toEqual({ document: null, inbox: null });
  });
  it('rejects unauthenticated requests and invalid transaction IDs', async () => {
    expect((await GET(request, { params: Promise.resolve({ id: 'invalid' }) })).status).toBe(400);
    expect(queries).toHaveLength(0);
    vi.mocked(getUserClient).mockRejectedValueOnce(new AuthError());
    expect((await GET(request, context)).status).toBe(401);
  });
  it('prefers an audited observation link over untrusted parsed provenance', async () => {
    tables.document_observations = { document_id: doc };
    tables.transactions = { id, parsed_data: { document_id: 'forged' } };
    expect((await GET(request, context)).status).toBe(200);
    expect(queries.find((q) => q.table === 'documents')?.eq).toHaveBeenCalledWith('id', doc);
  });
});
