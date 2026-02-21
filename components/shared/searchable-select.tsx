'use client';

import { useState, useCallback } from 'react';
import { Command } from 'cmdk';
import { CheckIcon, ChevronDownIcon, ChevronRight, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SearchableSelectItem {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  items: SearchableSelectItem[];
  className?: string;
  disabled?: boolean;
  collapsibleGroups?: boolean;
}

export function SearchableSelect({
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  items,
  className,
  disabled,
  collapsibleGroups = false,
}: SearchableSelectProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const selectedLabel = items.find((i) => i.value === value)?.label;

  const handleSelect = useCallback(
    (itemValue: string): void => {
      onValueChange(itemValue);
      setOpen(false);
      setSearch('');
    },
    [onValueChange],
  );

  const toggleGroup = useCallback((group: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  // Group items by their group field
  const groups = new Map<string | undefined, SearchableSelectItem[]>();
  for (const item of items) {
    const key = item.group;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const isSearching = search.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type='button'
          role='combobox'
          aria-expanded={open}
          aria-controls='searchable-select-list'
          className={cn(
            "border-border data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-11 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            className,
          )}
          data-placeholder={!selectedLabel || undefined}>
          <span className='truncate'>{selectedLabel ?? placeholder}</span>
          <ChevronDownIcon className='size-4 shrink-0 opacity-50' />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
        onOpenAutoFocus={(e): void => {
          e.preventDefault();
        }}>
        <Command shouldFilter={true} className='bg-popover text-popover-foreground' loop>
          <div className='border-border flex items-center gap-2 border-b px-3'>
            <Search className='text-muted-foreground size-4 shrink-0' />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
              className='placeholder:text-muted-foreground flex h-10 w-full bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50'
            />
          </div>
          <Command.List
            id='searchable-select-list'
            className='scrollbar-subtle !max-h-60 !overflow-y-auto overscroll-contain p-1'>
            {(!collapsibleGroups || isSearching) && (
              <Command.Empty className='text-muted-foreground py-6 text-center text-sm'>
                {emptyText}
              </Command.Empty>
            )}
            {[...groups.entries()].map(([group, groupItems]) =>
              group ? (
                <Command.Group
                  key={group}
                  heading={
                    collapsibleGroups && !isSearching ? (
                      <button
                        type='button'
                        className='flex w-full cursor-pointer items-center gap-1'
                        onClick={(e): void => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleGroup(group);
                        }}>
                        <ChevronRight
                          className={cn(
                            'size-3 transition-transform',
                            expandedGroups.has(group) && 'rotate-90',
                          )}
                        />
                        {group}
                      </button>
                    ) : (
                      group
                    )
                  }
                  className='[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs'>
                  {(!collapsibleGroups || isSearching || expandedGroups.has(group)) &&
                    groupItems.map((item) => (
                      <Command.Item
                        key={item.value}
                        value={item.label}
                        onSelect={(): void => handleSelect(item.value)}
                        className='focus:bg-accent focus:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'>
                        {item.label}
                        {value === item.value && <CheckIcon className='absolute right-2 size-4' />}
                      </Command.Item>
                    ))}
                </Command.Group>
              ) : (
                groupItems.map((item) => (
                  <Command.Item
                    key={item.value}
                    value={item.label}
                    onSelect={(): void => handleSelect(item.value)}
                    className='focus:bg-accent focus:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'>
                    {item.label}
                    {value === item.value && <CheckIcon className='absolute right-2 size-4' />}
                  </Command.Item>
                ))
              ),
            )}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
