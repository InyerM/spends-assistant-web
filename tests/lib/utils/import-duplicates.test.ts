import { describe, it, expect } from 'vitest';
import {
  duplicateKey,
  groupDuplicateCandidates,
  buildDuplicateOrFilter,
  mapMatchesToDuplicates,
  parseDuplicateReviews,
  evaluateDuplicateReviews,
  buildDuplicateReviews,
  validateImportRows,
  buildImportInsertRow,
} from '@/lib/utils/import-duplicates';
import type { ImportDuplicate } from '@/types/import';

const match = (id: string, overrides: Partial<ImportDuplicate['match']> = {}) => ({
  id,
  date: '2024-01-15',
  amount: 50000,
  description: 'Lunch',
  account_id: 'acc-1',
  ...overrides,
});

describe('duplicateKey', () => {
  it('normalizes numeric amounts so DB and CSV values compare equal', () => {
    expect(duplicateKey('2024-01-15', 50000, 'acc-1')).toBe(
      duplicateKey('2024-01-15', Number('50000.00'), 'acc-1'),
    );
  });
});

describe('groupDuplicateCandidates', () => {
  it('groups rows sharing date, amount and account, skipping unresolved accounts', () => {
    const groups = groupDuplicateCandidates([
      { date: '2024-01-15', amount: 100, account_id: 'acc-1' },
      { date: '2024-01-15', amount: 100, account_id: 'acc-1' },
      { date: '2024-01-15', amount: 100, account_id: null },
      { date: '2024-01-16', amount: 100, account_id: 'acc-1' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].indices).toEqual([0, 1]);
    expect(groups[1].indices).toEqual([3]);
  });
});

describe('buildDuplicateOrFilter', () => {
  it('builds a PostgREST or() filter per group', () => {
    const groups = groupDuplicateCandidates([
      { date: '2024-01-15', amount: 100, account_id: 'acc-1' },
    ]);
    expect(buildDuplicateOrFilter(groups)).toBe(
      'and(date.eq.2024-01-15,amount.eq.100,account_id.eq.acc-1)',
    );
  });
});

describe('mapMatchesToDuplicates', () => {
  it('maps each existing match to every CSV row in its group, ordered by index', () => {
    const groups = groupDuplicateCandidates([
      { date: '2024-01-16', amount: 5, account_id: 'acc-1' },
      { date: '2024-01-15', amount: 50000, account_id: 'acc-1' },
      { date: '2024-01-15', amount: 50000, account_id: 'acc-1' },
    ]);
    const result = mapMatchesToDuplicates(groups, [match('tx-1', { amount: 50000 })]);
    expect(result.map((d) => d.index)).toEqual([1, 2]);
    expect(result[0].match.id).toBe('tx-1');
  });

  it('returns nothing when no existing transaction matches (equal-amount rows in a file are kept)', () => {
    const groups = groupDuplicateCandidates([
      { date: '2024-01-15', amount: 100, account_id: 'acc-1' },
      { date: '2024-01-15', amount: 100, account_id: 'acc-1' },
    ]);
    expect(mapMatchesToDuplicates(groups, [])).toEqual([]);
  });
});

describe('validateImportRows', () => {
  const row = { date: '2024-01-15', amount: 100, account: 'Checking' };

  it('accepts well-formed rows', () => {
    expect(validateImportRows([row])).toBeNull();
    expect(validateImportRows([{ date: '2024-01-15', amount: 1, account_id: 'acc-1' }])).toBeNull();
  });

  it('rejects empty lists, bad dates, non-finite amounts and missing accounts', () => {
    expect(validateImportRows([])).toMatch(/No transactions/);
    expect(validateImportRows('x')).toMatch(/No transactions/);
    expect(validateImportRows([{ ...row, date: '2024-01-15),or(id.eq.1' }])).toMatch(/row 1/);
    expect(validateImportRows([{ ...row, amount: 'NaN' }])).toMatch(/row 1/);
    expect(validateImportRows([row, { ...row, amount: -5 }])).toMatch(/row 2/);
    expect(validateImportRows([{ date: '2024-01-15', amount: 1 }])).toMatch(/row 1/);
  });
});

describe('parseDuplicateReviews', () => {
  it('defaults to no reviews', () => {
    expect(parseDuplicateReviews(undefined, 3)).toEqual({ reviews: [] });
  });

  it('accepts valid reviews', () => {
    const reviews = [{ index: 0, match_ids: ['tx-1'], decision: 'skip' }];
    expect(parseDuplicateReviews(reviews, 1)).toEqual({ reviews });
  });

  it.each([
    ['not an array', {}],
    ['index out of range', [{ index: 5, match_ids: ['tx-1'], decision: 'skip' }]],
    ['non-integer index', [{ index: 0.5, match_ids: ['tx-1'], decision: 'skip' }]],
    ['unknown decision', [{ index: 0, match_ids: ['tx-1'], decision: 'force' }]],
    ['missing match ids', [{ index: 0, decision: 'import' }]],
    ['empty match ids', [{ index: 0, match_ids: [], decision: 'import' }]],
    [
      'duplicate index',
      [
        { index: 0, match_ids: ['tx-1'], decision: 'skip' },
        { index: 0, match_ids: ['tx-1'], decision: 'import' },
      ],
    ],
  ])('rejects %s', (_label, raw) => {
    expect(parseDuplicateReviews(raw, 1)).toHaveProperty('error');
  });
});

describe('evaluateDuplicateReviews', () => {
  const duplicates: ImportDuplicate[] = [
    { index: 0, match: match('tx-1') },
    { index: 0, match: match('tx-2') },
    { index: 2, match: match('tx-3') },
  ];

  it('flags every matched row without a review', () => {
    const result = evaluateDuplicateReviews(duplicates, []);
    expect(result.unreviewed).toEqual([0, 2]);
    expect(result.stale).toEqual([]);
  });

  it('flags reviews that do not cover every current match as stale', () => {
    const result = evaluateDuplicateReviews(duplicates, [
      { index: 0, match_ids: ['tx-1'], decision: 'import' },
      { index: 2, match_ids: ['tx-3'], decision: 'skip' },
    ]);
    expect(result.unreviewed).toEqual([]);
    expect(result.stale).toEqual([0]);
  });

  it('returns skip and confirm sets when every match is reviewed', () => {
    const result = evaluateDuplicateReviews(duplicates, [
      { index: 0, match_ids: ['tx-1', 'tx-2'], decision: 'import' },
      { index: 2, match_ids: ['tx-3'], decision: 'skip' },
    ]);
    expect(result.unreviewed).toEqual([]);
    expect(result.stale).toEqual([]);
    expect([...result.confirmedIndices]).toEqual([0]);
    expect([...result.skipIndices]).toEqual([2]);
  });

  it('honors skip on rows whose match disappeared, but ignores import there', () => {
    const result = evaluateDuplicateReviews(
      [],
      [
        { index: 1, match_ids: ['gone'], decision: 'skip' },
        { index: 2, match_ids: ['gone'], decision: 'import' },
      ],
    );
    expect([...result.skipIndices]).toEqual([1]);
    expect(result.confirmedIndices.size).toBe(0);
  });
});

describe('buildDuplicateReviews', () => {
  it('builds one review per row with all of its match ids', () => {
    const reviews = buildDuplicateReviews(
      [
        { index: 0, match: match('tx-1') },
        { index: 0, match: match('tx-2') },
        { index: 3, match: match('tx-3') },
      ],
      'skip',
    );
    expect(reviews).toEqual([
      { index: 0, match_ids: ['tx-1', 'tx-2'], decision: 'skip' },
      { index: 3, match_ids: ['tx-3'], decision: 'skip' },
    ]);
  });
});

describe('buildImportInsertRow', () => {
  const ctx = {
    userId: 'user-1',
    importId: 'import-1',
    accountId: 'acc-1',
    categoryId: null,
    confirmedDuplicate: false,
  };

  it('keeps only whitelisted fields and applies defaults', () => {
    const row = { date: '2024-01-15', amount: 5, user_id: 'x', deleted_at: 'y' };
    expect(buildImportInsertRow(row, ctx)).toEqual({
      date: '2024-01-15',
      time: '12:00:00',
      amount: 5,
      description: '',
      notes: null,
      type: 'expense',
      payment_method: null,
      source: 'csv_import',
      account_id: 'acc-1',
      category_id: null,
      user_id: 'user-1',
      import_id: 'import-1',
    });
  });

  it('marks reviewed duplicates as confirmed', () => {
    const inserted = buildImportInsertRow(
      { date: '2024-01-15', amount: 5 },
      { ...ctx, confirmedDuplicate: true },
    );
    expect(inserted.duplicate_status).toBe('confirmed');
  });
});
