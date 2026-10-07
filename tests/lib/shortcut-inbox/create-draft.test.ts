import { describe, expect, it } from 'vitest';
import {
  buildForwardedEmailDraft,
  inferForwardedAccount,
  inferForwardedBancolombiaAccount,
  suggestForwardedCategory,
} from '@/lib/shortcut-inbox/create-draft';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';

const receivedAt = '2026-09-26T01:20:00.000Z';
const rawText = [
  'From (unverified): notificaciones@lulobank.com',
  '',
  'Compra realizada',
  '',
  'Realizaste una compra en Demo Store por $121,000',
  'Origen tarjeta de crédito •8456',
  'Fecha 25 de septiembre de 2026',
  'Hora 7:18 p.m.',
].join('\n');
const preview = previewLuloNotice('forwarded_email', rawText, receivedAt)!;

describe('forwarded email creation draft', () => {
  it('prefills an older indented Lulo notice for review without confirming its time or guessing a category', () => {
    const stored = [
      'From (unverified): notificaciones@lulobank.com',
      '',
      'Compra realizada',
      '',
      '                    Realizaste una compra en CEA PRACTICAR DEL EJE por $1,550,000',
      'Origen tarjeta de crédito •8456',
      'Fecha 6 de octubre de 2026',
      'Hora 3:42 p.m.',
    ].join('\n');
    const parsed = previewLuloNotice('forwarded_email', stored, '2026-10-06T20:42:35Z');
    const account = {
      id: 'lulo-8456',
      name: 'Lulo credit card',
      institution: 'Lulobank',
      type: 'credit_card' as const,
      last_four: '8456',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };

    expect(buildForwardedEmailDraft(parsed, '2026-10-06T20:42:35Z')).toMatchObject({
      amount: '1550000.00',
      date: '2026-10-06',
      eventTime: '15:42',
      eventTimeConfirmed: false,
      description: 'CEA PRACTICAR DEL EJE',
    });
    expect(inferForwardedAccount(parsed, [account])).toBe('lulo-8456');
    expect(suggestForwardedCategory(parsed, [], [])).toBe('');
  });
  it('prefills only parsed purchase values and never confirms the event time', () => {
    expect(buildForwardedEmailDraft(preview, receivedAt)).toEqual({
      type: 'expense',
      amount: '121000.00',
      date: '2026-09-25',
      eventTime: '19:18',
      eventTimeConfirmed: false,
      description: 'Demo Store',
      notes: '',
    });
  });

  it('uses the receipt day and leaves financial fields empty for unrecognized messages', () => {
    const unknown = previewLuloNotice('forwarded_email', 'Unknown notice', receivedAt);
    expect(buildForwardedEmailDraft(unknown, receivedAt)).toMatchObject({
      amount: '',
      date: '2026-09-25',
      eventTime: '',
      description: '',
    });
  });

  it('proposes an account only for one active COP Lulo credit card with the exact suffix', () => {
    const card = {
      id: 'lulo-card',
      name: 'Lulo credit card',
      institution: 'Lulo Bank',
      type: 'credit_card' as const,
      last_four: '8456',
      bank_account_last_four: null,
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    expect(inferForwardedAccount(preview, [card])).toBe('lulo-card');
    expect(inferForwardedAccount(preview, [card, { ...card, id: 'other-card' }])).toBe('');
    expect(
      inferForwardedAccount(preview, [{ ...card, institution: 'Other Bank', name: 'Card' }]),
    ).toBe('');
  });

  it('suggests the uniquely matching Bancolombia credit card from explicit notice evidence', () => {
    const raw = [
      'From (unverified): alertas@an.notificacionesbancolombia.com',
      '',
      'Alertas y Notificaciones',
      '',
      'Bancolombia: Compraste $50.000 en TIENDAS ARA con tu T.Cred *8887',
    ].join('\n');
    const credit = {
      id: 'credit',
      name: 'Mastercard',
      institution: 'Bancolombia',
      type: 'credit_card' as const,
      last_four: '8887',
      bank_account_last_four: null,
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    const debit = { ...credit, id: 'debit', type: 'savings' as const };
    expect(inferForwardedBancolombiaAccount(raw, [credit, debit])).toBe('credit');
    expect(inferForwardedBancolombiaAccount(raw, [credit, { ...credit, id: 'second' }])).toBe('');
    expect(
      inferForwardedBancolombiaAccount(raw.replace('*8887', '*[number omitted]'), [credit]),
    ).toBe('');
    expect(
      inferForwardedBancolombiaAccount(
        raw.replace('an.notificacionesbancolombia.com', 'example.test'),
        [credit],
      ),
    ).toBe('');
  });

  it('suggests a debit account only when the Bancolombia notice says debit card', () => {
    const raw =
      'From (unverified): alertas@ayn.notificacionesbancolombia.com\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb *7799';
    const debit = {
      id: 'savings',
      name: 'Savings',
      institution: 'Bancolombia',
      type: 'savings' as const,
      last_four: '2651',
      bank_account_last_four: '7799',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    expect(inferForwardedBancolombiaAccount(raw, [debit])).toBe('savings');
    expect(inferForwardedBancolombiaAccount(raw, [{ ...debit, is_active: false }])).toBe('');
  });

  it('proposes a category only from recurring merchant history and an active expense category', () => {
    const history = [
      { description: 'Demo Store', type: 'expense' as const, category_id: 'food' },
      { description: 'Demo Store #123', type: 'expense' as const, category_id: 'food' },
    ];
    const category = { id: 'food', slug: 'food', type: 'expense' as const, is_active: true };
    expect(suggestForwardedCategory(preview, history, [category])).toBe('food');
    expect(suggestForwardedCategory(preview, history, [{ ...category, is_active: false }])).toBe(
      '',
    );
    expect(suggestForwardedCategory(preview, history.slice(0, 1), [category])).toBe('');
  });

  it('proposes groceries for a known supermarket without requiring two previous purchases', () => {
    const ara = previewLuloNotice(
      'forwarded_email',
      rawText.replace('Demo Store', 'TIENDAS ARA'),
      receivedAt,
    );
    const groceries = {
      id: 'groceries',
      slug: 'groceries',
      type: 'expense' as const,
      is_active: true,
    };
    expect(suggestForwardedCategory(ara, [], [groceries])).toBe('groceries');
    expect(suggestForwardedCategory(ara, [], [{ ...groceries, is_active: false }])).toBe('');
  });
});
