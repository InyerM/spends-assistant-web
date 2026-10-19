export function localizedCategoryPayload(
  existing: { name: string; translations?: Record<string, string> } | undefined,
  locale: string,
  name: string,
  translations: Record<string, string | undefined> = {},
): { name: string; translations: Record<string, string> } {
  const names = { ...existing?.translations };
  for (const [language, value] of Object.entries(translations)) {
    if (value?.trim()) names[language] = value.trim();
  }
  names[locale] = name.trim();
  return {
    name:
      locale === 'en'
        ? name.trim()
        : existing
          ? existing.name
          : Object.hasOwn(names, 'en')
            ? names.en
            : name.trim(),
    translations: names,
  };
}
