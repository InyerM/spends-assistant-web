import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/shortcut-inbox/[id]/analyze/route';
const { getUserClient } = vi.hoisted(() => ({ getUserClient: vi.fn() }));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));
vi.mock('@/lib/config', () => ({
  workerConfig: { url: 'https://worker.example', inboxAnalysisEnabled: true },
}));
const id = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id }) };
const request = (refresh = false, cookie = false) =>
  new Request(`https://web.example/api/shortcut-inbox/${id}/analyze`, {
    method: 'POST',
    headers: cookie ? { Origin: 'https://web.example' } : { Authorization: 'Bearer jwt' },
    body: JSON.stringify({ refresh }),
  });
function setup(source = 'sms-shortcut', cached: unknown = null) {
  const calls: string[] = [];
  const supabase = {
    from(table: string) {
      calls.push(table);
      const query = {
        select: () => query,
        eq: vi.fn().mockReturnThis(),
        maybeSingle: async () => ({
          data:
            table === 'shortcut_inbox_items'
              ? { id, user_id: 'owner', source, status: 'pending' }
              : cached,
          error: null,
        }),
      };
      return query;
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'cookie-jwt' } } }),
    },
  };
  getUserClient.mockResolvedValue({ supabase, userId: 'owner', accessToken: 'jwt' });
  return { calls, supabase };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
it.each(['sms-shortcut', 'apple-pay', 'forwarded_email'])(
  'uses canonical owner Worker analysis for %s without forwarding consent scope',
  async (source) => {
    const { calls } = setup(source);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ analysis_version: 3, status: 'needs_review', description: 'Suggestion' }),
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://worker.example/inbox/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' },
        body: JSON.stringify({ inbox_item_id: id, refresh: false }),
      }),
    );
    expect(calls).not.toContain('email_forwarding_routes');
  },
);
it('returns cached v3 immediately without AI and whitelists details', async () => {
  setup('sms-shortcut', {
    inbox_item_id: id,
    user_id: 'owner',
    analysis_version: 3,
    status: 'needs_review',
    description: 'Ready',
    analysis_details: { event_date: '2026-10-22', secret: 'never' },
  });
  const response = await POST(request(), context);
  const body = await response.json();
  expect(body).toMatchObject({ description: 'Ready', event_date: '2026-10-22' });
  expect(body).not.toHaveProperty('user_id');
  expect(body).not.toHaveProperty('secret');
  expect(fetch).not.toHaveBeenCalled();
});
it.each([202, 428, 429, 503])(
  'preserves canonical %s without fallback or a second provider call',
  async (status) => {
    setup('forwarded_email');
    vi.mocked(fetch).mockResolvedValue(
      Response.json(status === 202 ? { state: 'running' } : { error: 'Unavailable' }, { status }),
    );
    const response = await POST(request(true), context);
    expect(response.status).toBe(status);
    expect(fetch).toHaveBeenCalledOnce();
  },
);
it('retains cookie Origin validation for canonical analysis', async () => {
  const { supabase } = setup();
  getUserClient.mockResolvedValue({ supabase, userId: 'owner' });
  const incoming = new Request(`https://web.example/api/shortcut-inbox/${id}/analyze`, {
    method: 'POST',
    headers: { Origin: 'https://evil.example' },
  });
  expect((await POST(incoming, context)).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

it('does not confuse a missing item with an unavailable Worker endpoint', async () => {
  setup('forwarded_email');
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ error: 'Inbox item not found' }, { status: 404 }),
  );
  expect((await POST(request(), context)).status).toBe(404);
  expect(fetch).toHaveBeenCalledOnce();
});

it('forwards only the public quota contract, keeping provider details private', async () => {
  setup();
  vi.mocked(fetch).mockResolvedValue(
    Response.json(
      {
        error: 'private provider text',
        code: 'PARSE_LIMIT_REACHED',
        used: 5,
        limit: 5,
        debug: 'hidden',
      },
      { status: 429 },
    ),
  );
  const response = await POST(request(true), context);
  expect(await response.json()).toEqual({
    error: 'Parse limit reached',
    code: 'PARSE_LIMIT_REACHED',
    used: 5,
    limit: 5,
  });
});

it('returns the refreshed partial Barbería proposal without turning the undated inbox transfer into a posting', async () => {
  const { calls } = setup('native-bank-message');
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      analysis_version: 3,
      status: 'needs_review',
      category_id: 'barber',
      category_source: 'review_context',
      description: 'Transferencia a Mi barbería',
      amount: 30000,
      merchant: null,
      bank_event_at: null,
      account_id: null,
      event_date: null,
      analysis_source: 'history',
      evidence_ids: ['one', 'two'],
    }),
  );
  const response = await POST(request(true), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    status: 'needs_review',
    category_id: 'barber',
    amount: 30000,
    bank_event_at: null,
    account_id: null,
    event_date: null,
    analysis_source: 'history',
    evidence_ids: ['one', 'two'],
  });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(
    'https://worker.example/inbox/analyze',
    expect.objectContaining({ body: JSON.stringify({ inbox_item_id: id, refresh: true }) }),
  );
  expect(calls).not.toContain('transactions');
});
