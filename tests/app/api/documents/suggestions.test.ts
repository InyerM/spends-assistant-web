import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/documents/[id]/suggestions/route';

const {
  getUserClient,
  documentQuery,
  observationQuery,
  transactionQuery,
  accountQuery,
  documentEq,
  documentOwnerEq,
  observationEq,
  observationOwnerEq,
  transactionEq,
  transactionAmountEq,
  transactionGte,
  transactionLte,
  accountEq,
  historyQuery,
} = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  documentQuery: vi.fn(),
  observationQuery: vi.fn(),
  transactionQuery: vi.fn(),
  accountQuery: vi.fn(),
  documentEq: vi.fn(),
  documentOwnerEq: vi.fn(),
  observationEq: vi.fn(),
  observationOwnerEq: vi.fn(),
  transactionEq: vi.fn(),
  transactionAmountEq: vi.fn(),
  transactionGte: vi.fn(),
  transactionLte: vi.fn(),
  accountEq: vi.fn(),
  historyQuery: vi.fn(),
}));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const observation = {
  id: 'obs-1',
  amount: 12000,
  occurred_at_text: '2026-09-28',
  description: 'Cafe North',
  counterparty: null,
  reference: 'ABC12345',
  status: 'pending',
};

describe('GET document reconciliation suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentQuery.mockResolvedValue({ data: { id: 'doc-1', status: 'extracted' }, error: null });
    observationQuery.mockResolvedValue({ data: [observation], error: null });
    transactionQuery.mockResolvedValue({
      data: [
        {
          id: 'tx-1',
          amount: 12000,
          date: '2026-09-28',
          description: 'Cafe North',
          account_id: 'account-1',
          type: 'expense',
          raw_text: 'ABC12345',
        },
      ],
      error: null,
    });
    accountQuery.mockResolvedValue({ data: [{ id: 'account-1', name: 'Checking' }], error: null });
    historyQuery.mockResolvedValue({ data: [], error: null });

    const documentBuilder = { select: () => ({ eq: documentEq }) };
    documentEq.mockReturnValue({ eq: documentOwnerEq });
    documentOwnerEq.mockReturnValue({ single: documentQuery });
    const observationBuilder = { select: () => ({ eq: observationEq }) };
    observationEq.mockReturnValue({ eq: observationOwnerEq });
    observationOwnerEq.mockReturnValue({ order: observationQuery });
    const historyTail = { is: () => ({ not: () => ({ order: () => ({ limit: historyQuery }) }) }) };
    const transactionBuilder = {
      select: (columns: string) =>
        columns === 'description,type,category_id'
          ? { eq: () => historyTail }
          : { eq: transactionEq },
    };
    const transactionTail = {
      in: () => transactionTail,
      gte: transactionGte,
      lte: transactionLte,
      order: () => ({ limit: transactionQuery }),
    };
    transactionEq.mockReturnValue({ is: () => ({ eq: transactionAmountEq }) });
    transactionAmountEq.mockReturnValue(transactionTail);
    transactionGte.mockReturnValue(transactionTail);
    transactionLte.mockReturnValue(transactionTail);
    const accountBuilder = { select: () => ({ eq: accountEq }) };
    accountEq.mockReturnValue({ in: accountQuery });
    getUserClient.mockResolvedValue({
      userId: 'user-1',
      supabase: {
        from: (table: string) =>
          table === 'documents'
            ? documentBuilder
            : table === 'document_observations'
              ? observationBuilder
              : table === 'transactions'
                ? transactionBuilder
                : accountBuilder,
      },
    });
  });

  const request = () =>
    GET(new Request('http://localhost') as never, { params: Promise.resolve({ id: 'doc-1' }) });

  it('returns owner-scoped, read-only candidates without exposing raw transaction text', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].candidates[0]).toMatchObject({
      kind: 'candidate',
      transaction_id: 'tx-1',
      account_name: 'Checking',
      basis: 'exact_date',
    });
    expect(JSON.stringify(body)).not.toContain('raw_text');
    expect(JSON.stringify(body)).not.toContain('ABC12345');
    expect(documentEq).toHaveBeenCalledWith('id', 'doc-1');
    expect(documentOwnerEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(observationEq).toHaveBeenCalledWith('document_id', 'doc-1');
    expect(observationOwnerEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(transactionEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(transactionGte).toHaveBeenCalledWith('date', '2026-09-25');
    expect(transactionLte).toHaveBeenCalledWith('date', '2026-10-01');
    expect(accountEq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('searches signed bank debits by absolute amount', async () => {
    observationQuery.mockResolvedValue({ data: [{ ...observation, amount: -12000 }], error: null });
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].candidates).toHaveLength(1);
    expect(transactionAmountEq).toHaveBeenCalledWith('amount', 12000);
  });

  it('suggests a recurring historical merchant category without returning the account', async () => {
    observationQuery.mockResolvedValue({
      data: [{ ...observation, description: 'SUPERMERCADO MERCAMAS' }],
      error: null,
    });
    historyQuery.mockResolvedValue({
      data: [1, 2, 3].map(() => ({
        description: 'SUPERMERCADO MERCAMA',
        type: 'expense',
        category_id: 'groceries',
      })),
      error: null,
    });
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].category_suggestion).toEqual({
      type: 'expense',
      categoryId: 'groceries',
      evidenceCount: 3,
    });
    expect(body.data[0].category_suggestion.accountId).toBeUndefined();
  });

  it('uses the description when OCR names the bank as counterparty', async () => {
    observationQuery.mockResolvedValue({
      data: [{ ...observation, counterparty: 'Bancolombia', description: 'SUPERMERCADO MERCAMAS' }],
      error: null,
    });
    historyQuery.mockResolvedValue({
      data: [1, 2].map(() => ({
        description: 'Compra Mercama',
        type: 'expense',
        category_id: 'groceries',
      })),
      error: null,
    });
    const response = await request();
    expect((await response.json()).data[0].category_suggestion).toMatchObject({
      categoryId: 'groceries',
    });
  });

  it('refuses suggestions for another user document', async () => {
    documentQuery.mockResolvedValue({ data: null, error: null });
    const response = await request();
    expect(response.status).toBe(404);
    expect(observationQuery).not.toHaveBeenCalled();
    expect(transactionQuery).not.toHaveBeenCalled();
  });

  it('refuses suggestions before extraction', async () => {
    documentQuery.mockResolvedValue({ data: { id: 'doc-1', status: 'uploaded' }, error: null });
    const response = await request();
    expect(response.status).toBe(409);
    expect(transactionQuery).not.toHaveBeenCalled();
  });

  it('marks amount-only suggestions when the OCR date is ambiguous', async () => {
    observationQuery.mockResolvedValue({
      data: [{ ...observation, occurred_at_text: '28/09/26' }],
      error: null,
    });
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0].candidates[0].basis).toBe('amount_only');
    expect(transactionGte).not.toHaveBeenCalled();
    expect(transactionLte).not.toHaveBeenCalled();
  });

  it('does not query transactions for an observation already reviewed', async () => {
    observationQuery.mockResolvedValue({
      data: [{ ...observation, status: 'confirmed' }],
      error: null,
    });
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0]).toMatchObject({ status: 'confirmed', candidates: [] });
    expect(transactionQuery).not.toHaveBeenCalled();
  });
});
