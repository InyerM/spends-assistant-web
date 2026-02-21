import type { AccountType } from '@/types';

/**
 * Shared account type definitions used across create/edit dialogs.
 */
export const ACCOUNT_TYPES: { value: AccountType; labelKey: string }[] = [
  { value: 'checking', labelKey: 'checking' },
  { value: 'savings', labelKey: 'savings' },
  { value: 'credit_card', labelKey: 'creditCard' },
  { value: 'cash', labelKey: 'cash' },
  { value: 'investment', labelKey: 'investment' },
  { value: 'crypto', labelKey: 'crypto' },
  { value: 'credit', labelKey: 'credit' },
];

/**
 * Translation map for default account names.
 * Only default accounts that have well-known names need entries here.
 */
const DEFAULT_ACCOUNT_TRANSLATIONS: Partial<Record<string, Partial<Record<string, string>>>> = {
  Cash: {
    es: 'Efectivo',
    pt: 'Dinheiro',
    en: 'Cash',
  },
};

/**
 * Returns the translated account name for default accounts,
 * or the original name if no translation is available.
 */
export function getAccountDisplayName(name: string, locale: string): string {
  const translations = DEFAULT_ACCOUNT_TRANSLATIONS[name];
  if (translations && translations[locale]) {
    return translations[locale];
  }
  return name;
}
