import { expect, it } from 'vitest';
import { localizedCategoryPayload } from '@/lib/categories/localized-edit';
it('updates the edited language without hiding the change behind stale seed translations', () => {
  const result = localizedCategoryPayload(
    {
      name: 'New restaurants',
      translations: { es: 'Restaurantes', en: 'Restaurants', pt: 'Restaurantes' },
    },
    'es',
    'Comidas favoritas',
  );
  expect(result).toEqual({
    name: 'New restaurants',
    translations: { es: 'Comidas favoritas', en: 'Restaurants', pt: 'Restaurantes' },
  });
});
