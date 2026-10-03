import type { Account } from '@/types';

export interface SenderProvider {
  id: string;
  name: string;
  aliases: string[];
  discoveryQuery: string;
  exampleSender?: string;
  sourceUrl?: string;
}

export const SENDER_PROVIDERS: SenderProvider[] = [
  {
    id: 'bancolombia',
    name: 'Bancolombia',
    aliases: ['bancolombia'],
    discoveryQuery: 'bancolombia',
  },
  {
    id: 'lulo',
    name: 'Lulo Bank',
    aliases: ['lulo', 'lulobank'],
    discoveryQuery: 'lulobank.com',
    exampleSender: 'notificaciones@lulobank.com',
  },
  {
    id: 'falabella',
    name: 'Banco Falabella',
    aliases: ['falabella'],
    discoveryQuery: 'bancofalabella.com.co',
    sourceUrl: 'https://www.bancofalabella.com.co/verificacion-comunicaciones-recibidas',
  },
  {
    id: 'bogota',
    name: 'Banco de Bogotá',
    aliases: ['banco de bogota', 'bancodebogota'],
    discoveryQuery: 'bancodebogota',
    exampleSender: 'notificaciones@bancodebogota.net',
    sourceUrl:
      'https://portalst.bancodebogota.com.co/atencion-al-cliente/seguridad-bancaria/seguridad-comunicaciones-digitales',
  },
  {
    id: 'bbva',
    name: 'BBVA',
    aliases: ['bbva'],
    discoveryQuery: 'BBVA',
  },
  {
    id: 'nequi',
    name: 'Nequi',
    aliases: ['nequi'],
    discoveryQuery: 'Nequi',
  },
  {
    id: 'davivienda',
    name: 'Davivienda',
    aliases: ['davivienda'],
    discoveryQuery: 'Davivienda',
  },
  {
    id: 'nu',
    name: 'Nu',
    aliases: ['nu bank', 'nubank', 'nu colombia'],
    discoveryQuery: 'Nu Colombia',
  },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function providersForAccounts(
  accounts: Pick<Account, 'name' | 'institution' | 'is_active'>[],
): Array<SenderProvider & { hasAccount: boolean }> {
  return SENDER_PROVIDERS.map((provider) => ({
    ...provider,
    hasAccount: accounts.some(
      (account) =>
        account.is_active &&
        provider.aliases.some((alias) =>
          normalize(`${account.institution ?? ''} ${account.name}`).includes(alias),
        ),
    ),
  })).sort((left, right) => Number(right.hasAccount) - Number(left.hasAccount));
}

export function validatedSenderAddress(value: string): string | null {
  const address = value.trim().toLowerCase();
  if (address.length > 254 || !/^[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address)) {
    return null;
  }
  return address;
}
