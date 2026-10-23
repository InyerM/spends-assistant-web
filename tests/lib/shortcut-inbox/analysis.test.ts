import { describe, expect, it, vi } from 'vitest';
import { enrichInboxAnalysis, normalizeInboxAnalysis } from '@/lib/shortcut-inbox/analysis';

const id = '11111111-1111-4111-8111-111111111111';
const proposal = {
  inbox_item_id: id,
  user_id: 'owner',
  analysis_version: 3,
  status: 'needs_review',
  description: 'Synthetic purchase',
  category_id: 'category',
  amount: 4200,
  analysis_details: {
    explanation: 'Evidence suggestion',
    event_date: '2026-10-22',
    financial_type: 'expense',
    lease_token: 'must-not-leak',
    description: 'must-not-override',
  },
};
describe('persisted inbox analysis', () => {
  it('flattens only reviewed public details and never overrides canonical columns', () => {
    const result = normalizeInboxAnalysis(proposal);
    expect(result).toMatchObject({
      analysis_version: 3,
      description: 'Synthetic purchase',
      explanation: 'Evidence suggestion',
      event_date: '2026-10-22',
    });
    expect(result).not.toHaveProperty('user_id');
    expect(result).not.toHaveProperty('lease_token');
    expect(result).not.toHaveProperty('analysis_details');
    expect(normalizeInboxAnalysis({ ...proposal, analysis_version: 2 })).toBeUndefined();
  });
  it('uses exactly two owner-filtered batched reads regardless of row count', async () => {
    const calls: Array<{ table: string; owner?: string; ids?: string[]; columns?: string }> = [];
    const supabase = {
      from(table: string) {
        const call: (typeof calls)[number] = { table };
        calls.push(call);
        const query = {
          select(columns: string) {
            call.columns = columns;
            return query;
          },
          eq(_key: string, owner: string) {
            call.owner = owner;
            return query;
          },
          in(_key: string, ids: string[]) {
            call.ids = ids;
            return Promise.resolve({
              data:
                table === 'forwarded_email_analyses'
                  ? [proposal, { ...proposal, user_id: 'foreign', inbox_item_id: 'foreign' }]
                  : [
                      {
                        inbox_item_id: id,
                        user_id: 'owner',
                        state: 'running',
                        attempts: 1,
                        lease_token: 'hidden',
                      },
                    ],
              error: null,
            });
          },
        };
        return query;
      },
    };
    const result = await enrichInboxAnalysis(supabase as never, 'owner', [
      { id, status: 'pending' },
      { id: 'second', status: 'pending' },
    ]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.owner).toBe('owner');
      expect(call.ids).toEqual([id, 'second']);
      expect(call.columns).not.toContain('lease_token');
    }
    expect(result[0]).toMatchObject({
      analysis: { description: 'Synthetic purchase' },
      analysis_job: { state: 'running', attempts: 1 },
    });
    expect(result[0].analysis_job).not.toHaveProperty('lease_token');
    expect(result[1]).not.toHaveProperty('analysis');
  });
  it('does not query an empty page or invent readiness on a failed analysis read', async () => {
    const from = vi.fn();
    expect(await enrichInboxAnalysis({ from } as never, 'owner', [])).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

it('suggests a transfer destination only from distinct active owned COP accounts', async () => {
  const { analysisTransferDestination } = await import('@/lib/shortcut-inbox/analysis');
  const accounts = [
    { id: 'source', currency: 'COP', is_active: true, deleted_at: null },
    { id: 'destination', currency: 'COP', is_active: true, deleted_at: null },
  ];
  const analysis = {
    financial_type: 'transfer',
    account_id: 'source',
    transfer_to_account_id: 'destination',
  };
  expect(analysisTransferDestination(analysis as never, accounts as never)).toBe('destination');
  for (const invalid of [
    [],
    [{ ...accounts[1], currency: 'USD' }, accounts[0]],
    [{ ...accounts[1], is_active: false }, accounts[0]],
    [accounts[1]],
  ])
    expect(analysisTransferDestination(analysis as never, invalid as never)).toBe('');
  expect(
    analysisTransferDestination(
      { ...analysis, transfer_to_account_id: 'source' } as never,
      accounts as never,
    ),
  ).toBe('');
});
