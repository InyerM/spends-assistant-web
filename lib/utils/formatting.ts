const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-CO',
  pt: 'pt-BR',
};

export function formatCurrency(amount: number, currency: string = 'COP', locale?: string): string {
  const intlLocale = (locale && LOCALE_MAP[locale]) ?? 'es-CO';
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
