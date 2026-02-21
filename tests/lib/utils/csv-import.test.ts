import { describe, it, expect } from 'vitest';
import { FIELD_CONFIGS, UNMAPPED, buildAutoMapping, transformRow } from '@/lib/utils/csv-import';

describe('FIELD_CONFIGS', () => {
  it('has 9 field configurations', () => {
    expect(FIELD_CONFIGS).toHaveLength(9);
  });

  it('has 5 required fields', () => {
    const required = FIELD_CONFIGS.filter((c) => c.required);
    expect(required).toHaveLength(5);
  });

  it('has expected field names', () => {
    const fields = FIELD_CONFIGS.map((c) => c.field);
    expect(fields).toContain('account');
    expect(fields).toContain('date');
    expect(fields).toContain('amount');
    expect(fields).toContain('description');
    expect(fields).toContain('type');
  });
});

describe('buildAutoMapping', () => {
  it('maps matching headers to fields', () => {
    const headers = ['date', 'amount', 'description', 'type', 'account'];
    const mapping = buildAutoMapping(headers);
    expect(mapping.date).toBe('date');
    expect(mapping.amount).toBe('amount');
    expect(mapping.description).toBe('description');
    expect(mapping.type).toBe('type');
    expect(mapping.account).toBe('account');
  });

  it('uses UNMAPPED for missing headers', () => {
    const headers = ['date', 'amount'];
    const mapping = buildAutoMapping(headers);
    expect(mapping.category).toBe(UNMAPPED);
    expect(mapping.notes).toBe(UNMAPPED);
  });

  it('handles alias matching', () => {
    const headers = ['account_id', 'date', 'amount', 'note', 'type'];
    const mapping = buildAutoMapping(headers);
    expect(mapping.account).toBe('account_id');
    expect(mapping.description).toBe('note');
  });

  it('does not double-map note to both description and notes', () => {
    const headers = ['account', 'date', 'amount', 'note', 'type'];
    const mapping = buildAutoMapping(headers);
    expect(mapping.description).toBe('note');
    expect(mapping.notes).toBe(UNMAPPED);
  });

  it('does not reuse already-mapped headers', () => {
    const headers = ['account', 'date', 'amount', 'description', 'type', 'category'];
    const mapping = buildAutoMapping(headers);
    // Each header should only appear once in mapping values
    const usedHeaders = Object.values(mapping).filter((v) => v !== UNMAPPED);
    const uniqueHeaders = new Set(usedHeaders);
    expect(usedHeaders.length).toBe(uniqueHeaders.size);
  });
});

describe('transformRow', () => {
  const fullMapping = {
    account: 'account',
    date: 'date',
    amount: 'amount',
    description: 'description',
    type: 'type',
    category: 'category',
    notes: 'notes',
    payment_method: 'payment_method',
    transfer: UNMAPPED,
  } as const;

  it('transforms a basic row', () => {
    const row = {
      account: 'Checking',
      date: '2024-01-15',
      amount: '50000',
      description: 'Test',
      type: 'expense',
      category: 'Food',
      notes: '',
      payment_method: '',
    };
    const result = transformRow(row, fullMapping);
    expect(result.date).toBe('2024-01-15');
    expect(result.amount).toBe(50000);
    expect(result.description).toBe('Test');
    expect(result.type).toBe('expense');
    expect(result.account).toBe('Checking');
    expect(result.category).toBe('Food');
    expect(result.source).toBe('csv_import');
  });

  it('handles ISO date strings with time', () => {
    const row = {
      account: 'Checking',
      date: '2025-11-02T20:42:26.348Z',
      amount: '100',
      description: 'Test',
      type: 'expense',
      category: '',
      notes: '',
      payment_method: '',
    };
    const result = transformRow(row, fullMapping);
    expect(result.date).toBe('2025-11-02');
    expect(result.time).toBe('20:42:26');
  });

  it('defaults time to 12:00:00 for plain dates', () => {
    const row = {
      account: 'Checking',
      date: '2024-01-15',
      amount: '100',
      description: 'Test',
      type: 'expense',
      category: '',
      notes: '',
      payment_method: '',
    };
    const result = transformRow(row, fullMapping);
    expect(result.time).toBe('12:00:00');
  });

  it('uses absolute value for negative amounts', () => {
    const row = {
      account: 'Checking',
      date: '2024-01-15',
      amount: '-500',
      description: 'Test',
      type: 'expense',
      category: '',
      notes: '',
      payment_method: '',
    };
    const result = transformRow(row, fullMapping);
    expect(result.amount).toBe(500);
  });

  it('returns empty/null for unmapped fields', () => {
    const row = {
      account: 'Checking',
      date: '2024-01-15',
      amount: '100',
      description: 'Test',
      type: 'expense',
    };
    const mapping = {
      account: 'account',
      date: 'date',
      amount: 'amount',
      description: 'description',
      type: 'type',
      category: UNMAPPED,
      notes: UNMAPPED,
      payment_method: UNMAPPED,
      transfer: UNMAPPED,
    } as const;
    const result = transformRow(row, mapping);
    expect(result.category).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.payment_method).toBeNull();
  });

  it('detects transfer type from transfer column', () => {
    const mappingWithTransfer = {
      ...fullMapping,
      transfer: 'transfer',
    };
    const row = {
      account: 'Checking',
      date: '2024-01-15',
      amount: '100',
      description: 'Test',
      type: 'expense',
      category: '',
      notes: '',
      payment_method: '',
      transfer: 'true',
    };
    const result = transformRow(row, mappingWithTransfer);
    expect(result.type).toBe('transfer');
  });
});
