import { expect, it } from 'vitest';
import { categoryCollection } from '@/lib/categories/collections';
import type { CategoryWithChildren } from '@/types';
const tree = [
  {
    id: 'root',
    slug: 'vehicle',
    is_default: true,
    children: [
      { id: 'used', slug: 'leasing', is_default: true },
      { id: 'special', slug: 'art-collectibles', is_default: true },
      { id: 'custom', slug: 'mine', is_default: false },
    ],
  },
] as CategoryWithChildren[];
it('keeps used and custom categories in the usual list and their ancestors as containers', () => {
  expect(categoryCollection(tree, ['used'], 'usual')[0].children.map((c) => c.id)).toEqual([
    'used',
    'custom',
  ]);
  expect(categoryCollection(tree, ['used'], 'more')[0].children.map((c) => c.id)).toEqual([
    'special',
  ]);
});
it('offers a small starter selection when no history exists and preserves every category across both lists', () => {
  const input = [
    {
      id: 'food',
      slug: 'food-drinks',
      is_default: true,
      children: [
        { id: 'grocery', slug: 'groceries', is_default: true },
        { id: 'special', slug: 'art-collectibles', is_default: true },
      ],
    },
  ] as CategoryWithChildren[];
  expect(categoryCollection(input, [], 'usual')[0].children.map((c) => c.id)).toEqual(['grocery']);
  expect(categoryCollection(input, [], 'more')[0].children.map((c) => c.id)).toEqual(['special']);
});
