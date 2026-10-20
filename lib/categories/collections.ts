import type { CategoryWithChildren } from '@/types';
export type CategoryCollection = 'usual' | 'more';
const starter = new Set([
  'uncategorized',
  'uncategorized-income',
  'restaurant',
  'groceries',
  'delivery',
  'bar-cafe',
  'gifts',
  'clothes',
  'rent',
  'utilities',
  'fuel',
  'taxi',
  'public-transport',
  'health-care',
  'drugstore',
  'pets',
  'subscriptions',
  'software',
  'internet',
  'phone',
  'fees',
  'wage',
  'refunds',
  'dividends',
  'sale',
]);
export function categoryCollection(
  tree: CategoryWithChildren[],
  usedIds: string[],
  collection: CategoryCollection,
): CategoryWithChildren[] {
  const used = new Set(usedIds);
  function usual(category: CategoryWithChildren['children'][number]): boolean {
    return (
      used.has(category.id) ||
      !category.is_default ||
      category.slug === 'uncategorized' ||
      category.slug === 'uncategorized-income' ||
      (!used.size && starter.has(category.slug))
    );
  }
  return tree
    .map((parent) => ({
      ...parent,
      children: parent.children.filter((child) => usual(child) === (collection === 'usual')),
    }))
    .filter((parent) => parent.children.length > 0 || usual(parent) === (collection === 'usual'));
}
