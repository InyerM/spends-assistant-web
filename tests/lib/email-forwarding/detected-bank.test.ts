import { describe, expect, it } from 'vitest';
import { detectEmailBank } from '@/lib/email-forwarding/detected-bank';

describe('bank identification without sender authentication', () => {
  it('recognizes a bank from an exact sender domain', () => {
    expect(
      detectEmailBank('From (unverified): alert@example.test\n\nBancolombia: Pagaste $1.'),
    ).toBe('Bancolombia');
    expect(
      detectEmailBank('From (unverified): notificaciones@lulobank.com\n\nCompra realizada'),
    ).toBe('Lulo Bank');
  });
  it('rejects domain lookalikes and conflicting bank evidence', () => {
    expect(
      detectEmailBank('From (unverified): alert@lulobank.com.evil.test\n\nCompra realizada'),
    ).toBeNull();
    expect(
      detectEmailBank('From (unverified): alert@lulobank.com\n\nBancolombia: Pagaste $1.'),
    ).toBeNull();
    expect(
      detectEmailBank('From (unverified): unknown@example.test\n\nCompra realizada'),
    ).toBeNull();
  });
});
