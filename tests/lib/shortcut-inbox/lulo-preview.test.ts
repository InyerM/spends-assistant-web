import { describe, expect, it } from 'vitest';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';

const receivedAt = '2026-09-26T01:18:00.000Z';

function notice(purchase: string, extra = ''): string {
  return [
    'From: Lulo alerts <notificaciones@lulobank.com>',
    'Subject: Compra realizada',
    '',
    purchase,
    'Origen tarjeta de crédito •8456',
    'Fecha 25 de septiembre de 2026',
    'Hora 7:18 p.m.',
    extra,
  ].join('\n');
}

describe('Lulo Gmail notice preview', () => {
  it('holds a zero-amount card notice separately from a card purchase', () => {
    const rawText = notice('Realizaste una compra en Demo Store por $0');
    expect(previewLuloNotice('lulo-email-backfill', rawText, receivedAt)).toMatchObject({
      kind: 'zero_amount_authorization',
      confidence: 'structured',
      messageReceivedAt: receivedAt,
      bankEventAt: '2026-09-25T19:18:00-05:00',
      merchant: 'Demo Store',
      cardLastFour: '8456',
      amountText: '$0',
      amountDecimal: '0.00',
      currencySymbol: '$',
      currencyCode: null,
      excerpts: {
        purchase: 'Realizaste una compra en Demo Store por $0',
        card: 'Origen tarjeta de crédito •8456',
        date: 'Fecha 25 de septiembre de 2026',
        time: 'Hora 7:18 p.m.',
      },
    });
  });

  it('preserves the original one-decimal amount and separates event time from Gmail time', () => {
    const rawText = notice('Realizaste una compra en Example Network por $492,041.3');
    expect(previewLuloNotice('lulo-email-backfill', rawText, receivedAt)).toMatchObject({
      kind: 'card_purchase',
      confidence: 'structured',
      amountText: '$492,041.3',
      amountDecimal: '492041.30',
      bankEventAt: '2026-09-25T19:18:00-05:00',
      messageReceivedAt: receivedAt,
    });
  });

  it('previews a newly forwarded Lulo email without treating it as historical backfill', () => {
    const rawText = [
      'From (unverified): notificaciones@lulobank.com',
      '',
      'Compra realizada',
      '',
      'Realizaste una compra en Demo Store por $121,000',
      'Origen tarjeta de cr&eacute;dito &#8226;8456',
      'Fecha 25 de septiembre de 2026',
      'Hora 7:18 p.m.',
    ].join('\n');
    expect(previewLuloNotice('forwarded_email', rawText, receivedAt)).toMatchObject({
      kind: 'card_purchase',
      merchant: 'Demo Store',
      cardLastFour: '8456',
      amountDecimal: '121000.00',
    });
  });

  it('decodes stored HTML entities in historical Lulo card evidence', () => {
    const rawText = notice('Realizaste una compra en TIENDAS ARA por $50,000').replace(
      'crédito •8456',
      'cr&eacute;dito &#8226;8456',
    );
    expect(previewLuloNotice('lulo-email-backfill', rawText, receivedAt)).toMatchObject({
      kind: 'card_purchase',
      cardLastFour: '8456',
      merchant: 'TIENDAS ARA',
    });
  });

  it('parses a Gmail plain body with CRLF line endings', () => {
    const rawText = notice('Realizaste una compra en Demo Store por $100').replaceAll('\n', '\r\n');
    expect(previewLuloNotice('lulo-email-backfill', rawText, receivedAt)?.kind).toBe(
      'card_purchase',
    );
  });

  it('withholds a purchase decision when the email contains two possible events', () => {
    const rawText = notice(
      'Realizaste una compra en Demo Store por $100',
      'Realizaste una compra en Another Store por $200',
    );
    expect(previewLuloNotice('lulo-email-backfill', rawText, receivedAt)).toMatchObject({
      kind: 'needs_review',
      confidence: 'low',
      amountDecimal: null,
      merchant: null,
    });
  });

  it('withholds incomplete or malformed date, card, and amount evidence', () => {
    for (const rawText of [
      notice('Realizaste una compra en Demo Store por $12', 'Origen tarjeta de crédito •9999'),
      notice('Realizaste una compra en Demo Store por $12').replace(
        '25 de septiembre',
        '32 de septiembre',
      ),
      notice('Realizaste una compra en Demo Store por $12,34,56'),
    ]) {
      const result = previewLuloNotice('lulo-email-backfill', rawText, receivedAt);
      expect(result).toMatchObject({ kind: 'needs_review', confidence: 'low' });
    }
  });

  it('does not classify a payment, another sender, or another inbox source as a purchase', () => {
    expect(
      previewLuloNotice(
        'lulo-email-backfill',
        notice('Realizaste un pago a tu tarjeta por $100'),
        receivedAt,
      )?.kind,
    ).toBe('needs_review');
    expect(
      previewLuloNotice(
        'lulo-email-backfill',
        notice('Realizaste una compra en Demo Store por $100').replace(
          'notificaciones@lulobank.com',
          'other@example.test',
        ),
        receivedAt,
      )?.kind,
    ).toBe('needs_review');
    expect(
      previewLuloNotice(
        'sms-shortcut',
        notice('Realizaste una compra en Demo Store por $100'),
        receivedAt,
      ),
    ).toBeNull();
  });
});
