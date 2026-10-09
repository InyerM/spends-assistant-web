import { describe, expect, it } from 'vitest';
import { previewBancolombiaNotice } from '@/lib/shortcut-inbox/bancolombia-preview';

const sender =
  'From (unverified): alerts@ayn.notificacionesbancolombia.com\n\nAlertas y Notificaciones\n\n';

describe('Bancolombia forwarded notice preview', () => {
  it('extracts purchase fields and bank time from a debit card alert', () => {
    const notice = `${sender}Bancolombia: Compraste $15.000 en CODA.CO con tu T.Deb *9989, el 05/10/2026 a las 11:46. Si tienes dudas, llama.`;
    expect(previewBancolombiaNotice('forwarded_email', notice)).toMatchObject({
      kind: 'purchase',
      amountDecimal: '15000.00',
      date: '2026-10-05',
      time: '11:46',
      merchant: 'CODA.CO',
      sourceLastFour: '9989',
      sourceKind: 'debit',
    });
  });

  it('extracts a credit card alert when the card follows the bank time', () => {
    const notice = `${sender}&iexcl;Listo! Bancolombia: Compraste COP320,98 en AMAZON.COM LLC, el 06/10/2026 a las 12:07. Esta compra esta asociada a T.Cred *4899.`;
    expect(previewBancolombiaNotice('forwarded_email', notice)).toMatchObject({
      kind: 'purchase',
      amountDecimal: '320.98',
      date: '2026-10-06',
      time: '12:07',
      merchant: 'AMAZON.COM LLC',
      sourceLastFour: '4899',
      sourceKind: 'credit',
      currency: 'COP',
    });
  });

  it('distinguishes a transfer source from its recipient and accepts two-digit years', () => {
    const notice = `${sender}Bancolombia: Transferiste $200.000 desde tu cuenta *2651 a la cuenta *9112 el 06/10/26 a las\n17:15.`;
    expect(previewBancolombiaNotice('forwarded_email', notice)).toMatchObject({
      kind: 'transfer',
      amountDecimal: '200000.00',
      date: '2026-10-06',
      time: '17:15',
      sourceLastFour: '2651',
      sourceKind: 'debit',
    });
  });

  it('parses a payment product and seconds without treating the recipient bank as the source', () => {
    const notice = `${sender}Bancolombia: Pagaste $2.900.000 a LULO BANK S A desde tu producto 2651 el 04/10/2026 10:59:40.`;
    expect(previewBancolombiaNotice('forwarded_email', notice)).toMatchObject({
      kind: 'payment',
      amountDecimal: '2900000.00',
      date: '2026-10-04',
      time: '10:59',
      sourceLastFour: '2651',
      sourceKind: 'debit',
    });
  });

  it('withholds unsupported and redacted fields without borrowing Gmail receipt time', () => {
    const notice = `${sender}Bancolombia: Compraste $15.000 en CODA.CO con tu T.Deb *[number omitted], el 05/10/[number omitted] a las 11:46.`;
    expect(previewBancolombiaNotice('forwarded_email', notice)).toMatchObject({
      kind: 'purchase',
      amountDecimal: '15000.00',
      date: null,
      time: null,
      sourceLastFour: null,
    });
    expect(
      previewBancolombiaNotice(
        'forwarded_email',
        notice.replace('notificacionesbancolombia.com', 'example.test'),
      ),
    ).toBeNull();
  });
});

it('keeps an explicit bank date when the alert omits its hour', () => {
  const result = previewBancolombiaNotice(
    'forwarded_email',
    'From (unverified): alertas@notificacionesbancolombia.com\nBancolombia: Compraste COP119.000 en Store con tu T.Deb *7799, el 23/11/24.',
  );
  expect(result).toMatchObject({ date: '2024-11-23', time: null });
});
