import { describe, expect, it } from 'vitest';
import { ingestBatch, type InboxStore, type InboxRow } from '@/lib/shortcut-inbox/intake';

const item = (received_at: string, external_id?: string) => ({
  external_id,
  received_at,
  raw_text: 'Synthetic transfer notice for 10,000 COP',
});

function memoryStore(): InboxStore & { rows: InboxRow[] } {
  const rows: InboxRow[] = [];
  return {
    rows,
    async create(row) {
      if (
        rows.some(
          (existing) =>
            existing.user_id === row.user_id && existing.idempotency_key === row.idempotency_key,
        )
      ) {
        return { duplicate: true };
      }
      const stored = { ...row, id: `item-${rows.length + 1}`, status: 'pending' };
      rows.push(stored);
      return { row: stored };
    },
    async findByKey(userId, key) {
      return rows.find((row) => row.user_id === userId && row.idempotency_key === key) ?? null;
    },
  };
}

describe('Shortcut inbox intake', () => {
  it('replays a repeated batch without creating extra rows', async () => {
    const store = memoryStore();
    const batch = {
      source: 'sms-shortcut',
      items: [item('2026-09-29T10:00:00.000Z', 'message-1')],
    };
    const first = await ingestBatch(batch, 'user-a', store);
    const second = await ingestBatch(batch, 'user-a', store);
    expect(first.items[0].status).toBe('received');
    expect(second.items[0].status).toBe('previously_received');
    expect(store.rows).toHaveLength(1);
  });

  it('uses normalized text and received timestamp when external ID is absent', async () => {
    const store = memoryStore();
    await ingestBatch(
      { source: 'sms-shortcut', items: [item('2026-09-29T10:00:00Z')] },
      'user-a',
      store,
    );
    const repeat = await ingestBatch(
      {
        source: 'sms-shortcut',
        items: [
          {
            ...item('2026-09-29T10:00:00.000Z'),
            raw_text: '  synthetic   TRANSFER notice for 10,000 COP  ',
          },
        ],
      },
      'user-a',
      store,
    );
    expect(repeat.items[0].status).toBe('previously_received');
    expect(store.rows).toHaveLength(1);
  });

  it('treats a null external ID as absent', async () => {
    const store = memoryStore();
    const result = await ingestBatch(
      { source: 'sms-shortcut', items: [{ ...item('2026-09-29T10:00:00Z'), external_id: null }] },
      'user-a',
      store,
    );
    expect(result.items[0].status).toBe('received');
    expect(store.rows[0].external_id).toBeNull();
  });

  it('keeps two same-value messages with distinct receipt times', async () => {
    const store = memoryStore();
    const result = await ingestBatch(
      {
        source: 'sms-shortcut',
        items: [item('2026-09-29T10:00:00Z'), item('2026-09-29T10:01:00Z')],
      },
      'user-a',
      store,
    );
    expect(result.items.map((entry) => entry.status)).toEqual(['received', 'received']);
    expect(store.rows).toHaveLength(2);
  });

  it('keeps same-value messages distinct when stable external IDs differ', async () => {
    const store = memoryStore();
    const result = await ingestBatch(
      {
        source: 'sms-shortcut',
        items: [
          item('2026-09-29T10:00:00Z', 'message-a'),
          item('2026-09-29T10:00:00Z', 'message-b'),
        ],
      },
      'user-a',
      store,
    );
    expect(result.items.map((entry) => entry.status)).toEqual(['received', 'received']);
    expect(store.rows).toHaveLength(2);
  });

  it('returns per-item validation errors while saving valid items', async () => {
    const store = memoryStore();
    const result = await ingestBatch(
      {
        source: 'sms-shortcut',
        items: [item('2026-09-29T10:00:00Z'), { ...item('bad-date'), external_id: 'broken' }],
      },
      'user-a',
      store,
    );
    expect(result.items.map((entry) => entry.status)).toEqual(['received', 'invalid']);
    expect(store.rows).toHaveLength(1);
  });

  it('retains informational messages for private review without classification', async () => {
    const store = memoryStore();
    const result = await ingestBatch(
      {
        source: 'sms-shortcut',
        items: [
          { ...item('2026-09-29T10:00:00Z'), raw_text: 'Synthetic one-time code notification' },
        ],
      },
      'user-a',
      store,
    );
    expect(result.items[0].status).toBe('received');
    expect(store.rows[0].status).toBe('pending');
  });

  it('isolates a storage failure to its item and continues the batch', async () => {
    const store = memoryStore();
    const create = store.create.bind(store);
    let attempts = 0;
    store.create = async (row) => {
      if (attempts++ === 0) throw new Error('synthetic database failure');
      return create(row);
    };
    const result = await ingestBatch(
      {
        source: 'sms-shortcut',
        items: [item('2026-09-29T10:00:00Z'), item('2026-09-29T10:01:00Z')],
      },
      'user-a',
      store,
    );
    expect(result.items.map((entry) => entry.status)).toEqual(['error', 'received']);
    expect(store.rows).toHaveLength(1);
  });

  it('rejects impossible calendar dates rather than shifting the receipt time', async () => {
    const store = memoryStore();
    const result = await ingestBatch(
      { source: 'sms-shortcut', items: [item('2026-02-30T10:00:00Z')] },
      'user-a',
      store,
    );
    expect(result.items[0].status).toBe('invalid');
    expect(store.rows).toHaveLength(0);
  });

  it('does not de-duplicate matching events across users', async () => {
    const store = memoryStore();
    const batch = {
      source: 'sms-shortcut',
      items: [item('2026-09-29T10:00:00Z', 'same-message-id')],
    };
    await ingestBatch(batch, 'user-a', store);
    const second = await ingestBatch(batch, 'user-b', store);
    expect(second.items[0].status).toBe('received');
    expect(store.rows).toHaveLength(2);
  });

  it('refuses a reused external ID with changed content', async () => {
    const store = memoryStore();
    await ingestBatch(
      { source: 'sms-shortcut', items: [item('2026-09-29T10:00:00Z', 'message-1')] },
      'user-a',
      store,
    );
    const changed = await ingestBatch(
      {
        source: 'sms-shortcut',
        items: [
          { ...item('2026-09-29T10:00:00Z', 'message-1'), raw_text: 'Different synthetic message' },
        ],
      },
      'user-a',
      store,
    );
    expect(changed.items[0].status).toBe('conflict');
    expect(store.rows).toHaveLength(1);
  });

  it('rejects malformed top-level batches without writing', async () => {
    const store = memoryStore();
    await expect(
      ingestBatch({ source: 'sms-shortcut', items: [] }, 'user-a', store),
    ).rejects.toThrow('Invalid batch');
    expect(store.rows).toHaveLength(0);
  });
});
