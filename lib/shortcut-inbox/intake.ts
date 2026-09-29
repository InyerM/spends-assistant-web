export interface InboxRow {
  id: string;
  user_id: string;
  source: string;
  external_id: string | null;
  received_at: string;
  raw_text: string;
  idempotency_key: string;
  status: string;
}

export type NewInboxRow = Omit<InboxRow, 'id' | 'status'>;

export interface InboxStore {
  create(row: NewInboxRow): Promise<{ row: InboxRow } | { duplicate: true }>;
  findByKey(userId: string, key: string): Promise<InboxRow | null>;
}

export interface IntakeItemResult {
  index: number;
  status: 'received' | 'previously_received' | 'invalid' | 'conflict' | 'error';
  id?: string;
  error?: 'invalid_item' | 'id_reused_with_different_content' | 'storage_error';
}

export interface IntakeResult {
  items: IntakeItemResult[];
}

const MAX_ITEMS = 25;
const MAX_TEXT_LENGTH = 4096;

function normalizeText(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return (
    year >= 1900 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
  );
}

function validItem(value: unknown): value is {
  external_id?: string | null;
  received_at: string;
  raw_text: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    validTimestamp(row.received_at) &&
    typeof row.raw_text === 'string' &&
    row.raw_text.length <= MAX_TEXT_LENGTH &&
    normalizeText(row.raw_text).length > 0 &&
    (row.external_id === undefined ||
      row.external_id === null ||
      (typeof row.external_id === 'string' &&
        row.external_id.length <= 256 &&
        row.external_id.trim().length > 0))
  );
}

async function fingerprint(parts: string[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equivalent(existing: InboxRow, incoming: NewInboxRow): boolean {
  return (
    existing.source === incoming.source &&
    existing.external_id === incoming.external_id &&
    new Date(existing.received_at).toISOString() === incoming.received_at &&
    normalizeText(existing.raw_text) === normalizeText(incoming.raw_text)
  );
}

export async function ingestBatch(
  input: unknown,
  userId: string,
  store: InboxStore,
): Promise<IntakeResult> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid batch');
  const batch = input as Record<string, unknown>;
  if (
    typeof batch.source !== 'string' ||
    !/^[a-z][a-z0-9_-]{1,39}$/u.test(batch.source) ||
    !Array.isArray(batch.items) ||
    batch.items.length < 1 ||
    batch.items.length > MAX_ITEMS
  ) {
    throw new Error('Invalid batch');
  }

  const results: IntakeItemResult[] = [];
  for (const [index, item] of batch.items.entries()) {
    if (!validItem(item)) {
      results.push({ index, status: 'invalid', error: 'invalid_item' });
      continue;
    }
    const receivedAt = new Date(item.received_at).toISOString();
    const externalId = item.external_id ?? null;
    const key = await fingerprint(
      externalId === null
        ? [batch.source, 'fallback', normalizeText(item.raw_text), receivedAt]
        : [batch.source, 'external_id', externalId],
    );
    const row: NewInboxRow = {
      user_id: userId,
      source: batch.source,
      external_id: externalId,
      received_at: receivedAt,
      raw_text: item.raw_text,
      idempotency_key: key,
    };
    try {
      const created = await store.create(row);
      if ('row' in created) {
        results.push({ index, status: 'received', id: created.row.id });
        continue;
      }
      const existing = await store.findByKey(userId, key);
      if (existing && equivalent(existing, row)) {
        results.push({ index, status: 'previously_received', id: existing.id });
      } else {
        results.push({ index, status: 'conflict', error: 'id_reused_with_different_content' });
      }
    } catch {
      results.push({ index, status: 'error', error: 'storage_error' });
    }
  }
  return { items: results };
}
