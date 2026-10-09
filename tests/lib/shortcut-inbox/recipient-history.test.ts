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
