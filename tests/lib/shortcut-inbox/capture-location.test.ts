import { it, expect } from 'vitest';
import { ingestBatch, type InboxRow, type InboxStore } from '@/lib/shortcut-inbox/intake';
it('validates optional coordinates and retains them as capture evidence independently of money', async () => {
  const rows: InboxRow[] = [];
  const store: InboxStore = {
    create: async (row) => {
      const created = { ...row, id: 'capture', status: 'pending' };
      rows.push(created);
      return { row: created };
    },
    findByKey: async () => null,
  };
  const base = { raw_text: 'Synthetic payment', received_at: '2026-10-10T12:00:00Z' };
  const valid = { latitude: 4.8, longitude: -75.7, captured_at: '2026-10-10T12:00:00Z' };
  const result = await ingestBatch(
    {
      source: 'apple-pay-shortcut',
      items: [
        { ...base, capture_location: valid },
        { ...base, capture_location: { ...valid, latitude: 100 } },
      ],
    },
    'owner',
    store,
  );
  expect(result.items.map((row) => row.status)).toEqual(['received', 'invalid']);
  expect(rows[0]).toMatchObject({ capture_location: valid, status: 'pending' });
});
