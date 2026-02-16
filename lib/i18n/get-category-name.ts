import type { Category } from '@/types';
import type { Locale } from '@/i18n/config';

/**
 * Returns the translated category name for the given locale.
 * Falls back to `category.name` when no translation is available.
 */
export function getCategoryName(category: Category, locale: Locale): string {
  if (category.translations && locale in category.translations) {
    const translated = category.translations[locale];
    if (translated) return translated;
  }
  return category.name;
}
