import { expect, it } from 'vitest';
import {
  recipientFromEmail,
  suggestRecipientHistory,
} from '@/lib/shortcut-inbox/recipient-history';
it('requires two consistent payments to the exact recipient', () => {
  const raw = 'Transferiste $36,000.00 desde tu cuenta *2651 a la cuenta *3248292427';
  expect(recipientFromEmail(raw)).toBe('3248292427');
  const row = {
    category_id: 'food',
    description: 'Almuerzo Liliana',
    notes: 'Domicilio',
    raw_text: raw,
  };
  expect(suggestRecipientHistory('3248292427', [row])).toBeNull();
  expect(suggestRecipientHistory('3248292427', [row, row])).toMatchObject({
    category_id: 'food',
    description: 'Almuerzo Liliana',
  });
  expect(suggestRecipientHistory('3248292427', [row, { ...row, category_id: 'gift' }])).toBeNull();
  expect(suggestRecipientHistory('3248292427', [{ ...row, raw_text: raw + '1' }, row])).toBeNull();
});

it('recognizes Nequi and payment keys without confusing the source or incoming sender', () => {
  expect(
    recipientFromEmail(
      'Bancolombia: Transferiste $45.000 desde tu cuenta *1234 a Nequi 3001112233 el 01/10/26',
    ),
  ).toBe('3001112233');
  expect(
    recipientFromEmail(
      'Bancolombia: Pagaste $45.000 desde tu cuenta *1234 a la llave 3001112233 el 01/10/26',
    ),
  ).toBe('3001112233');
  expect(
    recipientFromEmail(
      'Bancolombia: Recibiste una transferencia de ACME por $45.000 en tu cuenta *1234 conectada a la llave 3001112233',
    ),
  ).toBeNull();
  expect(
    recipientFromEmail('Transferiste a la cuenta *3001112233 y a la cuenta *3004445566'),
  ).toBeNull();
});

it('uses exact destination evidence for key and Nequi history', () => {
  const row = {
    category_id: 'food',
    description: 'Almuerzo',
    notes: null,
    raw_text: 'Pagaste $45.000 desde tu cuenta *1234 a la llave 3001112233',
  };
  expect(
    suggestRecipientHistory('3001112233', [
      row,
      { ...row, raw_text: 'Transferiste $45.000 a Nequi 3001112233' },
    ]),
  ).toMatchObject({ category_id: 'food' });
  expect(
    suggestRecipientHistory('3001112233', [
      row,
      { ...row, raw_text: 'Pagaste desde tu cuenta *3001112233 a la llave 3004445566' },
    ]),
  ).toBeNull();
});

it('proposes a dominant confirmed category while withholding divided history', () => {
  const row = {
    category_id: 'food',
    description: 'Almuerzo',
    notes: null,
    raw_text: 'Transferiste a la cuenta *3001112233',
  };
  const other = { ...row, category_id: 'gift' };
  expect(
    suggestRecipientHistory('3001112233', [...Array.from({ length: 10 }, () => row), other]),
  ).toMatchObject({ category_id: 'food' });
  expect(suggestRecipientHistory('3001112233', [row, row, other])).toBeNull();
});
