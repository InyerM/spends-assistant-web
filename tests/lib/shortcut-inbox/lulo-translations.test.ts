import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import pt from '@/messages/pt.json';

const previewKeys = [
  'luloCardPurchase',
  'luloZeroAmount',
  'luloNeedsReview',
  'luloStructured',
  'luloLow',
  'luloEmailTime',
  'luloBankTime',
  'luloMerchant',
  'luloCard',
  'luloOriginalAmount',
  'luloCurrencyUnknown',
  'luloEvidence',
  'luloCaution',
  'luloZeroCaution',
] as const;

describe('Lulo inbox preview translations', () => {
  it.each([en, es, pt])('has every preview label in each supported locale', (messages) => {
    for (const key of previewKeys) {
      expect(messages.shortcutInbox[key].trim()).not.toBe('');
    }
  });
});
