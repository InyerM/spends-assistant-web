import { SENDER_PROVIDERS } from './sender-catalog';

const domains: Partial<Record<string, string[]>> = {
  bancolombia: ['bancolombia.com.co', 'notificacionesbancolombia.com', 'documentosbancolombia.com'],
  lulo: ['lulobank.com'],
  falabella: ['bancofalabella.com.co'],
  bogota: ['bancodebogota.net', 'bancodebogota.com.co'],
  bbva: ['bbva.com.co'],
  nequi: ['nequi.com.co'],
  davivienda: ['davivienda.com'],
  nu: ['nubank.com.co', 'nu.com.co'],
};

/** Identifies the claimed bank, never authenticates the sender. */
export function detectEmailBank(rawText: string): string | null {
  const sender = /^From \(unverified\): ([^\n]+)\n/u.exec(rawText)?.[1].trim().toLowerCase();
  const domain = sender?.split('@').at(-1) ?? '';
  const content = rawText
    .replace(/^From \(unverified\): [^\n]+\n/u, '')
    .slice(0, 800)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase();
  const matches = SENDER_PROVIDERS.filter(
    (provider) =>
      domains[provider.id]?.some((known) => domain === known || domain.endsWith(`.${known}`)) ||
      provider.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, 'u').test(content)),
  );
  return matches.length === 1 ? matches[0].name : null;
}
