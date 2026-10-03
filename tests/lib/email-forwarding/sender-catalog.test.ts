import { describe, expect, it } from 'vitest';
import {
  providersForAccounts,
  validatedSenderAddress,
} from '@/lib/email-forwarding/sender-catalog';

describe('sender catalogue', () => {
  it('puts banks with active matching accounts first', () => {
    const providers = providersForAccounts([
      { name: 'Lulo credit card', institution: 'Lulobank', is_active: true },
    ]);
    expect(providers[0]).toMatchObject({ name: 'Lulo Bank', hasAccount: true });
    expect(providers.find(({ name }) => name === 'BBVA')?.hasAccount).toBe(false);
  });

  it('accepts complete sender addresses but rejects domain-only criteria', () => {
    expect(validatedSenderAddress(' Notificaciones@LuloBank.com ')).toBe(
      'notificaciones@lulobank.com',
    );
    expect(validatedSenderAddress('@lulobank.com')).toBeNull();
  });
});
