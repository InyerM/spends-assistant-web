import { describe, expect, it } from 'vitest';
import { parseExtraction, validateDocumentImage } from '@/lib/documents';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);

describe('document input', () => {
  it('accepts a matching supported image signature', () => {
    expect(validateDocumentImage('receipt.png', 'image/png', png)).toBeNull();
  });

  it('rejects spoofed image bytes and unsupported types', () => {
    expect(
      validateDocumentImage('receipt.png', 'image/png', new Uint8Array([1, 2, 3])),
    ).toBeTruthy();
    expect(validateDocumentImage('receipt.pdf', 'application/pdf', png)).toBeTruthy();
  });

  it('rejects empty and oversized files', () => {
    expect(validateDocumentImage('empty.png', 'image/png', new Uint8Array())).toBeTruthy();
    expect(
      validateDocumentImage('large.png', 'image/png', new Uint8Array(5 * 1024 * 1024 + 1)),
    ).toBeTruthy();
  });
});

describe('vision extraction contract', () => {
  it('accepts observations that remain drafts', () => {
    const result = parseExtraction({
      draft: {
        document_type: 'receipt',
        observations: [
          {
            amount: 1000,
            currency: 'COP',
            occurred_at: '2026-09-28',
            description: 'Coffee',
            counterparty: null,
            reference: null,
            source_excerpt: 'Coffee 1000',
            confidence: 0.9,
          },
        ],
      },
      model: 'test',
      usage: {},
    });
    expect(result?.draft.observations[0].description).toBe('Coffee');
  });

  it('rejects malformed and non-finite amounts', () => {
    expect(
      parseExtraction({
        draft: { document_type: 'other', observations: [{ amount: Infinity }] },
        model: 'test',
        usage: {},
      }),
    ).toBeNull();
  });
});
