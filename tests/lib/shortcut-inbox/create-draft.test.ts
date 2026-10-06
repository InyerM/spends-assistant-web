import { describe, expect, it } from 'vitest';
import {
  buildForwardedEmailDraft,
  inferForwardedAccount,
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
  it('prefills only parsed purchase values and never confirms the event time', () => {
    expect(buildForwardedEmailDraft(preview, receivedAt)).toEqual({
      type: 'expense',
      amount: '121000.00',
      date: '2026-09-25',
      eventTime: '19:18',
      eventTimeConfirmed: false,
      description: 'Demo Store',
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

  it('proposes a category only from recurring merchant history and an active expense category', () => {
    const history = [
      { description: 'Demo Store', type: 'expense' as const, category_id: 'food' },
      { description: 'Demo Store #123', type: 'expense' as const, category_id: 'food' },
    ];
    const category = { id: 'food', type: 'expense' as const, is_active: true };
    expect(suggestForwardedCategory(preview, history, [category])).toBe('food');
    expect(suggestForwardedCategory(preview, history, [{ ...category, is_active: false }])).toBe(
      '',
    );
    expect(suggestForwardedCategory(preview, history.slice(0, 1), [category])).toBe('');
  });
});
