import { describe, expect, it } from 'vitest';
import { suggestDocumentReview, validateDocumentDraft } from '@/lib/document-review';

const current = {
  id: 'current',
  description: 'Restaurant North',
  counterparty: 'Restaurant North',
  source_excerpt: 'Purchase $12.000',
  currency: 'USD',
  document_type: 'bank_screenshot',
};

describe('document review suggestions', () => {
  it('suggests the account currency for an ambiguous dollar sign but preserves explicit USD', () => {
    expect(suggestDocumentReview(current, [], 'COP').currency).toEqual({
      value: 'COP',
      reason: 'account',
    });
    expect(
      suggestDocumentReview({ ...current, source_excerpt: 'Purchase USD 12.000' }, [], 'COP')
        .currency,
    ).toBeNull();
  });

  it('uses previous owner corrections as a future currency hint', () => {
    const history = [
      {
        ...current,
        id: 'prior',
        currency: 'COP',
        reviewed_at: '2026-09-30T12:00:00Z',
        extracted_snapshot: { currency: 'USD' },
        status: 'confirmed',
      },
    ];
    expect(suggestDocumentReview(current, history, null).currency).toEqual({
      value: 'COP',
      reason: 'review',
    });
  });

  it('learns a reviewed merchant category and flags a previously rejected match', () => {
    const history = [
      {
        ...current,
        id: 'confirmed',
        status: 'confirmed',
        matched_transaction: { type: 'expense', category_id: 'food', account_id: 'account-1' },
      },
      { ...current, id: 'rejected', status: 'rejected' },
    ];
    const suggestion = suggestDocumentReview(current, history, 'COP');
    expect(suggestion.transaction).toEqual({
      type: 'expense',
      categoryId: 'food',
      accountId: 'account-1',
    });
    expect(suggestion.previouslyRejected).toBe(true);
  });
});

describe('document approval validation', () => {
  it('requires a confirmed COP account and transaction details before bulk approval', () => {
    const base = {
      amount: '12000',
      currency: 'COP',
      date: '2026-09-28',
      time: '',
      description: 'Restaurant North',
      type: 'expense' as const,
      accountId: 'account-1',
      destinationAccountId: '',
    };
    expect(
      validateDocumentDraft(base, [{ id: 'account-1', currency: 'COP', is_active: true }]),
    ).toEqual([]);
    expect(
      validateDocumentDraft({ ...base, currency: 'USD' }, [
        { id: 'account-1', currency: 'COP', is_active: true },
      ]),
    ).toContain('currency');
    expect(
      validateDocumentDraft({ ...base, accountId: '' }, [
        { id: 'account-1', currency: 'COP', is_active: true },
      ]),
    ).toContain('account');
  });
});
