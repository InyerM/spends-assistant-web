import { describe, expect, it } from 'vitest';
import {
  inferDocumentTransactionType,
  inferAccountFromEvidence,
  inferCategoryFromHistory,
  suggestDocumentReview,
  validateDocumentDraft,
} from '@/lib/document-review';

const current = {
  id: 'current',
  description: 'Restaurant North',
  counterparty: 'Restaurant North',
  source_excerpt: 'Purchase $12.000',
  currency: 'USD',
  document_type: 'bank_screenshot',
};

describe('document review suggestions', () => {
  it('treats a positive receipt purchase as an expense and an explicit incoming credit as income', () => {
    expect(inferDocumentTransactionType(12000, 'Mercamás', 'Total $12.000')).toBe('expense');
    expect(
      inferDocumentTransactionType(12000, 'Mercamás', 'Bancolombia: Compraste $12.000 en Mercamás'),
    ).toBe('expense');
    expect(
      inferDocumentTransactionType(
        12000,
        'Transferencia recibida',
        'Bancolombia: Recibiste $12.000',
      ),
    ).toBe('income');
  });
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

  it('defaults ambiguous Colombian amounts to COP even with a USD account', () => {
    expect(suggestDocumentReview(current, [], null).currency).toEqual({
      value: 'COP',
      reason: 'default',
    });
  });

  it('uses explicit card or bank suffix for account suggestions and leaves issuer-only evidence unresolved', () => {
    const accounts = [
      {
        id: 'debit',
        institution: 'Bancolombia',
        name: 'Ahorros',
        type: 'savings',
        last_four: '7799',
        bank_account_last_four: '2651',
        currency: 'COP',
        is_active: true,
      },
      {
        id: 'card',
        institution: 'Bancolombia',
        name: 'Mastercard',
        type: 'credit_card',
        last_four: '0265',
        bank_account_last_four: null,
        currency: 'COP',
        is_active: true,
      },
    ];
    expect(inferAccountFromEvidence('Bancolombia: compraste con tarjeta *0265', accounts)).toEqual({
      accountId: 'card',
      basis: 'suffix',
    });
    expect(inferAccountFromEvidence('Bancolombia: recibiste en cuenta 2651', accounts)).toEqual({
      accountId: 'debit',
      basis: 'suffix',
    });
    expect(inferAccountFromEvidence('Bancolombia: pago realizado', accounts)).toBeNull();
  });

  it('suggests Mercamas category from similar approved ledger merchants without copying their account', () => {
    const result = inferCategoryFromHistory('SUPERMERCADO MERCAMAS', [
      { description: 'SUPERMERCADO MERCAMA', type: 'expense', category_id: 'groceries' },
      { description: 'SUPERMERCADO MERCAMA', type: 'expense', category_id: 'groceries' },
      { description: 'SUPERMERCADO MERCAMA', type: 'expense', category_id: 'groceries' },
    ]);
    expect(result).toEqual({ type: 'expense', categoryId: 'groceries', evidenceCount: 3 });
    expect(
      inferCategoryFromHistory('SUPERMERCADO MERCAMAS', [
        { description: 'SUPERMERCADO MERCAMA', type: 'expense', category_id: 'groceries' },
        { description: 'SUPERMERCADO MERCAMA', type: 'expense', category_id: 'other' },
      ]),
    ).toBeNull();
    expect(
      inferCategoryFromHistory('SUPERMERCADO MERCAMAS', [
        { description: 'Compra Mercama', type: 'expense', category_id: 'groceries' },
        { description: 'Pago Mercamas', type: 'expense', category_id: 'groceries' },
      ]),
    ).toEqual({ type: 'expense', categoryId: 'groceries', evidenceCount: 2 });
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
