'use client';

import { Fragment } from 'react';
import { SelectGroup, SelectItem, SelectLabel, SelectSeparator } from '@/components/ui/select';
import type { Category } from '@/types';

interface CategorySelectItemsProps {
  categories: Category[];
  filterType?: string;
}

export function CategorySelectItems({
  categories,
  filterType,
}: CategorySelectItemsProps): React.ReactElement {
  const filtered = filterType ? categories.filter((c) => c.type === filterType) : categories;
  const parents = filtered.filter((c) => !c.parent_id);
  const getChildren = (parentId: string): Category[] =>
    filtered.filter((c) => c.parent_id === parentId);

  return (
    <>
      {parents.map((parent, idx) => {
        const children = getChildren(parent.id);
        if (children.length === 0) {
          return (
            <SelectItem key={parent.id} value={parent.id}>
              {parent.icon ? `${parent.icon} ` : ''}
              {parent.name}
            </SelectItem>
          );
        }
        return (
          <Fragment key={parent.id}>
            {idx > 0 && <SelectSeparator />}
            <SelectGroup>
              <SelectLabel>
                {parent.icon ? `${parent.icon} ` : ''}
                {parent.name}
              </SelectLabel>
              <SelectItem value={parent.id} className='pl-4'>
                All {parent.name}
              </SelectItem>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id} className='pl-6'>
                  {child.icon ? `${child.icon} ` : ''}
                  {child.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </Fragment>
        );
      })}
    </>
  );
}
