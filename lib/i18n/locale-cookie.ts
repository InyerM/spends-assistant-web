import { defaultLocale, isValidLocale, type Locale } from '@/i18n/config';

const COOKIE_NAME = 'locale';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Reads the current locale from the browser cookie.
 * Returns the default locale ('es') if cookie is missing or invalid.
 */
export function getLocaleCookie(): Locale {
  if (typeof document === 'undefined') return defaultLocale;

  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const value = match?.[1];
  return isValidLocale(value) ? value : defaultLocale;
}

/**
 * Sets the locale cookie on the client and triggers a full page reload
 * so that next-intl picks up the new locale from the server.
 */
export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}
