import type { SearchableSelectItem } from '@/components/shared/searchable-select';
import type { Account } from '@/types/account';
import type { Category } from '@/types/category';
import type { Locale } from '@/i18n/config';
import { getCategoryName } from '@/lib/i18n/get-category-name';

export function buildAccountItems(accounts: Account[]): SearchableSelectItem[] {
  return accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }));
}

export function buildCategoryItems(
  categories: Category[],
  filterType?: string,
  options?: { locale?: Locale; allPrefix?: (name: string) => string },
): SearchableSelectItem[] {
  const locale = options?.locale;
  const allPrefix = options?.allPrefix ?? ((name: string): string => `All ${name}`);

  const getName = (cat: Category): string => (locale ? getCategoryName(cat, locale) : cat.name);

  const filtered = filterType ? categories.filter((c) => c.type === filterType) : categories;
  const parents = filtered.filter((c) => !c.parent_id);
  const getChildren = (parentId: string): Category[] =>
    filtered.filter((c) => c.parent_id === parentId);

  const items: SearchableSelectItem[] = [];

  for (const parent of parents) {
    const children = getChildren(parent.id);
    const parentName = getName(parent);
    const parentLabel = parent.icon ? `${parent.icon} ${parentName}` : parentName;

    if (children.length === 0) {
      items.push({ value: parent.id, label: parentLabel });
    } else {
      const groupName = parentLabel;
      items.push({ value: parent.id, label: allPrefix(parentName), group: groupName });
      for (const child of children) {
        const childName = getName(child);
        const childLabel = child.icon ? `${child.icon} ${childName}` : childName;
        items.push({ value: child.id, label: childLabel, group: groupName });
      }
    }
  }

  return items;
}
