import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/transactions/account-corrections/route';
import { AuthError } from '@/lib/api/server';

const { getUserClient, rpc, from } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  errorResponse: (message: string, status = 500) => Response.json({ error: message }, { status }),
}));

const transactionId = '11111111-1111-4111-8111-111111111111';
const oldAccount = '22222222-2222-4222-8222-222222222222';
const savings = '33333333-3333-4333-8333-333333333333';
const decision = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const reviewed = {
  request_id: requestId,
  transaction_id: transactionId,
  match_decision_id: decision,
  expected_account_id: oldAccount,
  expected_amount: '150000.00',
  new_account_id: savings,
  new_amount: null,
  evidence: { document: 'Q3-savings.pdf', page: 3, line: 'posting 42' },
};

function request(body: unknown): Request {
  return new Request('https://example.test/api/transactions/account-corrections', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rows(data: unknown): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'ilike', 'is', 'order', 'limit']) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query.then = (resolve: (result: unknown) => unknown): Promise<unknown> =>
    Promise.resolve({ data, error: null }).then(resolve);
  return query;
}

describe('reviewed debit-account corrections API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({ userId: 'owner-a', supabase: { from, rpc } });
    rpc.mockResolvedValue({
      data: { correction: { id: 'audit-1' }, replayed: false },
      error: null,
    });
  });

  it('lists only active matched debit-card expenses whose ledger account is a credit card', async () => {
    const accounts = rows([
      {
        id: oldAccount,
        name: 'Card',
        type: 'credit_card',
        is_active: true,
        institution: 'Bancolombia',
        bank_account_last_four: null,
      },
      {
        id: savings,
        name: 'Savings',
        type: 'savings',
        is_active: true,
        institution: 'Bancolombia',
        bank_account_last_four: '2651',
      },
    ]);
    const transactions = rows([
      {
        id: transactionId,
        account_id: oldAccount,
        amount: 150000,
        date: '2026-08-03',
        time: '13:40:00',
        description: 'Purchase',
        raw_text: 'Bancolombia: Compraste con tu T.Deb *9989',
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        account_id: savings,
        amount: 50000,
        date: '2026-08-04',
        time: '12:00:00',
        description: 'Already in savings',
        raw_text: 'Bancolombia: Compraste con tu T.Deb *9989',
      },
    ]);
    const decisions = rows([
      { id: decision, transaction_id: transactionId, inbox_item_id: 'inbox-1' },
    ]);
    const reversals = rows([]);
    from.mockImplementation((table: string) => {
      const queries: Record<string, unknown> = {
        accounts,
        transactions,
        shortcut_inbox_match_decisions: decisions,
        shortcut_inbox_match_reversals: reversals,
      };
      return queries[table];
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        expect.objectContaining({
          id: transactionId,
          match_decision_id: decision,
          current_account_name: 'Card',
        }),
      ],
      destinations: [{ id: savings, name: 'Savings' }],
    });
    expect(
      vi.mocked((transactions as { ilike: ReturnType<typeof vi.fn> }).ilike),
    ).toHaveBeenCalledWith('raw_text', '%T.Deb *9989%');
    for (const query of [accounts, transactions, decisions, reversals]) {
      expect((query as { eq: ReturnType<typeof vi.fn> }).eq).toHaveBeenCalledWith(
        'user_id',
        'owner-a',
      );
    }
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('sends a bounded reviewed statement to one owner-scoped atomic RPC', async () => {
    const response = await POST(request(reviewed) as never);
    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith('correct_shortcut_matched_expense', {
      p_request_id: requestId,
      p_transaction_id: transactionId,
      p_match_decision_id: decision,
      p_expected_account_id: oldAccount,
      p_expected_amount: '150000.00',
      p_new_account_id: savings,
      p_new_amount: null,
      p_evidence: {
        source: 'bank_statement',
        document: 'Q3-savings.pdf',
        page: 3,
        line: 'posting 42',
      },
    });
    expect(from).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects malformed evidence, extra fields, and unsafe amounts before the RPC', async () => {
    for (const body of [
      { ...reviewed, user_id: 'other' },
      { ...reviewed, evidence: { ...reviewed.evidence, page: 0 } },
      { ...reviewed, evidence: { ...reviewed.evidence, line: '' } },
      { ...reviewed, expected_amount: '-150000.00' },
      { ...reviewed, new_amount: '150000.001' },
      { ...reviewed, new_account_id: oldAccount },
    ]) {
      expect((await POST(request(body) as never)).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps stale state and owner errors without revealing financial details', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } });
    expect((await POST(request(reviewed) as never)).status).toBe(409);
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002' } });
    expect((await POST(request(reviewed) as never)).status).toBe(404);
    getUserClient.mockRejectedValueOnce(new AuthError());
    expect((await POST(request(reviewed) as never)).status).toBe(401);
  });
});
