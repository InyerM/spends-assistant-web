import { describe, expect, it } from 'vitest';
import {
  createTransactionFormSchema,
  fieldsAfterTypeChange,
  toTransactionPatch,
} from '@/lib/transactions/form-draft';

const categories = [
  { id: 'expense-category', type: 'expense' as const },
  { id: 'income-category', type: 'income' as const },
  { id: 'transfer-category', type: 'transfer' as const },
];
const draft = {
  date: '2026-09-29',
  time: '12:00',
  amount: 1200,
  description: 'Synthetic transaction',
  type: 'expense' as const,
  account_id: 'account-a',
  category_id: 'expense-category',
  transfer_to_account_id: undefined as string | undefined,
};

describe('transaction form draft', () => {
  const schema = createTransactionFormSchema(categories);

  it('requires a different destination account for transfers', () => {
    const missing = schema.safeParse({
      ...draft,
      type: 'transfer',
      category_id: 'transfer-category',
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0].path).toEqual(['transfer_to_account_id']);
    }
    const same = schema.safeParse({
      ...draft,
      type: 'transfer',
      category_id: 'transfer-category',
      transfer_to_account_id: draft.account_id,
    });
    expect(same.success).toBe(false);
    expect(
      schema.safeParse({
        ...draft,
        type: 'transfer',
        category_id: 'transfer-category',
        transfer_to_account_id: 'account-b',
      }).success,
    ).toBe(true);
  });

  it('rejects a destination on a non-transfer and an incompatible category', () => {
    const staleDestination = schema.safeParse({ ...draft, transfer_to_account_id: 'account-b' });
    expect(staleDestination.success).toBe(false);
    const staleCategory = schema.safeParse({ ...draft, type: 'income' });
    expect(staleCategory.success).toBe(false);
    if (!staleCategory.success) {
      expect(staleCategory.error.issues[0].path).toEqual(['category_id']);
    }
  });

  it('clears incompatible category and destination when the type changes', () => {
    const transfer = {
      ...draft,
      type: 'transfer' as const,
      category_id: 'transfer-category',
      transfer_to_account_id: 'account-b',
    };
    expect(fieldsAfterTypeChange(transfer, 'income')).toEqual({
      type: 'income',
      category_id: undefined,
      transfer_to_account_id: undefined,
    });
    expect(fieldsAfterTypeChange(transfer, 'transfer')).toEqual({
      type: 'transfer',
      category_id: 'transfer-category',
      transfer_to_account_id: 'account-b',
    });
  });

  it('sends explicit nulls when review clears category or transfer destination', () => {
    const patch = toTransactionPatch({
      ...draft,
      category_id: undefined,
      transfer_to_account_id: undefined,
    });
    expect(patch).toMatchObject({ category_id: null, transfer_to_account_id: null });
    expect(patch).not.toHaveProperty('source');
  });
});

it('sends only changed notes without resubmitting legacy time values or financial fields', () => {
  const original = {
    ...draft,
    time: '14:30:00.123456',
    notes: 'Old note',
    category_id: null,
    transfer_to_account_id: null,
  };
  expect(
    toTransactionPatch(
      {
        ...original,
        notes: 'Updated note',
        category_id: undefined,
        transfer_to_account_id: undefined,
      },
      original,
    ),
  ).toEqual({ notes: 'Updated note' });
});
