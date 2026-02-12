import type { SearchableSelectItem } from '@/components/shared/searchable-select';
import type { Account } from '@/types/account';
import type { Category } from '@/types/category';

export function buildAccountItems(accounts: Account[]): SearchableSelectItem[] {
  return accounts.map((a) => ({
    value: a.id,
    label: a.name,
  }));
}

export function buildCategoryItems(
  categories: Category[],
  filterType?: string,
): SearchableSelectItem[] {
  const filtered = filterType ? categories.filter((c) => c.type === filterType) : categories;
  const parents = filtered.filter((c) => !c.parent_id);
  const getChildren = (parentId: string): Category[] =>
    filtered.filter((c) => c.parent_id === parentId);

  const items: SearchableSelectItem[] = [];

  for (const parent of parents) {
    const children = getChildren(parent.id);
    const parentLabel = parent.icon ? `${parent.icon} ${parent.name}` : parent.name;

    if (children.length === 0) {
      items.push({ value: parent.id, label: parentLabel });
    } else {
      const groupName = parentLabel;
      items.push({ value: parent.id, label: `All ${parent.name}`, group: groupName });
      for (const child of children) {
        const childLabel = child.icon ? `${child.icon} ${child.name}` : child.name;
        items.push({ value: child.id, label: childLabel, group: groupName });
      }
    }
  }

  return items;
}
