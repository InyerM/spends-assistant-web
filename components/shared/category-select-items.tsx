'use client';

import { Fragment } from 'react';
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Category } from '@/types';
import type { Locale } from '@/i18n/config';

interface CategorySelectItemsProps {
  categories: Category[];
  filterType?: string;
  locale?: Locale;
  allPrefix?: (name: string) => string;
}

export function CategorySelectItems({
  categories,
  filterType,
  locale,
  allPrefix = (name: string): string => `All ${name}`,
}: CategorySelectItemsProps): React.ReactElement {
  const filtered = filterType ? categories.filter((c) => c.type === filterType) : categories;
  const parents = filtered.filter((c) => !c.parent_id);
  const getChildren = (parentId: string): Category[] =>
    filtered.filter((c) => c.parent_id === parentId);

  const getName = (cat: Category): string => (locale ? getCategoryName(cat, locale) : cat.name);

  return (
    <>
      {parents.map((parent, idx) => {
        const children = getChildren(parent.id);
        const parentName = getName(parent);
        if (children.length === 0) {
          return (
            <SelectItem key={parent.id} value={parent.id}>
              {parent.icon ? `${parent.icon} ` : ''}
              {parentName}
            </SelectItem>
          );
        }
        return (
          <Fragment key={parent.id}>
            {idx > 0 && <SelectSeparator />}
            <SelectGroup>
              <SelectLabel>
                {parent.icon ? `${parent.icon} ` : ''}
                {parentName}
              </SelectLabel>
              <SelectItem value={parent.id} className='pl-4'>
                {allPrefix(parentName)}
              </SelectItem>
              {children.map((child) => {
                const childName = getName(child);
                return (
                  <SelectItem key={child.id} value={child.id} className='pl-6'>
                    {child.icon ? `${child.icon} ` : ''}
                    {childName}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </Fragment>
        );
      })}
    </>
  );
}
