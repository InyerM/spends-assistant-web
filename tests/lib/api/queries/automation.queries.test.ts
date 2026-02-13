import { describe, it, expect, vi, beforeEach } from 'vitest';
import { automationKeys, fetchAutomationRules } from '@/lib/api/queries/automation.queries';

describe('automationKeys', () => {
  it('all returns base key', () => {
    expect(automationKeys.all).toEqual(['automation-rules']);
  });

  it('lists extends all', () => {
    expect(automationKeys.lists()).toEqual(['automation-rules', 'list']);
  });

  it('list extends lists', () => {
    expect(automationKeys.list()).toEqual(['automation-rules', 'list']);
  });
});

describe('fetchAutomationRules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches automation rules list', async () => {
    const rules = [{ id: 'rule-1' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(rules), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await fetchAutomationRules();
    expect(result).toEqual(rules);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 500 })),
    );

    await expect(fetchAutomationRules()).rejects.toThrow('Failed to fetch automation rules');
  });
});
