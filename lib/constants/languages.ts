import type { Locale } from '@/i18n/config';

export interface LanguageOption {
  value: Locale;
  label: string;
  nativeLabel: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'es', label: 'Spanish', nativeLabel: 'Espanol' },
  { value: 'pt', label: 'Portuguese', nativeLabel: 'Portugues' },
];
