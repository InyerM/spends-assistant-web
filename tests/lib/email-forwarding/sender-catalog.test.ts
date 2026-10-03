import { describe, expect, it } from 'vitest';
import {
  prepareBroadForwardingQuery,
  prepareSenderQuery,
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

  it('groups distinct exact senders from several banks into one Gmail OR search', () => {
    expect(
      prepareSenderQuery(
        'Avisos@Bancolombia.example\nnotificaciones@lulobank.com, avisos@bancolombia.example',
      ),
    ).toEqual({
      addresses: ['avisos@bancolombia.example', 'notificaciones@lulobank.com'],
      invalidEntries: [],
      query: '{from:avisos@bancolombia.example from:notificaciones@lulobank.com}',
    });
  });

  it('rejects a broad bank domain instead of generating a partial filter', () => {
    expect(prepareSenderQuery('avisos@banco.example\n@bancolombia.com')).toMatchObject({
      invalidEntries: ['@bancolombia.com'],
      query: null,
    });
    expect(prepareSenderQuery('avisos@banco.example').query).toBe('from:avisos@banco.example');
  });

  it('captures bank keywords across message content and optional exact senders', () => {
    expect(
      prepareBroadForwardingQuery('Bancolombia\nLuloBank\nBancolombia', 'avisos@otro.example'),
    ).toMatchObject({
      query: '{bancolombia lulobank from:avisos@otro.example}',
      invalidEntries: [],
    });
    expect(prepareBroadForwardingQuery('Banco de Bogotá', '').query).toBe('"banco de bogotá"');
  });

  it('rejects operator-like keyword input rather than broadening the Gmail search', () => {
    expect(prepareBroadForwardingQuery('@bancolombia.com', '').query).toBeNull();
    expect(prepareBroadForwardingQuery('bancolombia', '@lulobank.com').query).toBeNull();
  });
});
