import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
} from '@/lib/api/mutations/automation.mutations';

describe('createAutomationRule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST and returns rule', async () => {
    const rule = { id: 'rule-1', name: 'Test' };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(rule), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await createAutomationRule({
      name: 'Test',
      conditions: {},
      actions: {},
    } as never);
    expect(result).toEqual(rule);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Bad request' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(createAutomationRule({ name: '' } as never)).rejects.toThrow('Bad request');
  });
});

describe('updateAutomationRule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends PATCH and returns updated rule', async () => {
    const rule = { id: 'rule-1', name: 'Updated' };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(rule), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await updateAutomationRule({ id: 'rule-1', name: 'Updated' } as never);
    expect(result).toEqual(rule);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Update failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(updateAutomationRule({ id: 'rule-1' } as never)).rejects.toThrow('Update failed');
  });
});

describe('deleteAutomationRule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends DELETE and returns success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await deleteAutomationRule('rule-1');
    expect(result.success).toBe(true);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Cannot delete' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(deleteAutomationRule('rule-1')).rejects.toThrow('Cannot delete');
  });
});

describe('toggleAutomationRule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends PATCH with is_active', async () => {
    const rule = { id: 'rule-1', is_active: false };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(rule), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    const result = await toggleAutomationRule({ id: 'rule-1', is_active: false });
    expect(result).toEqual(rule);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe('/api/automation-rules/rule-1');
    const body = JSON.parse(fetchCall[1].body as string);
    expect(body.is_active).toBe(false);
  });

  it('throws on error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'Toggle failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    await expect(toggleAutomationRule({ id: 'rule-1', is_active: true })).rejects.toThrow(
      'Toggle failed',
    );
  });
});
