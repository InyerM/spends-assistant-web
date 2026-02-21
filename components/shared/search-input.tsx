'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: SearchInputProps): React.ReactElement {
  return (
    <div className={`relative ${className ?? ''}`}>
      <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e): void => onChange(e.target.value)}
        className='h-9 pr-8 pl-10 text-sm'
      />
      {value ? (
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          onClick={(): void => onChange('')}
          className='text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer'>
          <X className='h-4 w-4' />
        </Button>
      ) : null}
    </div>
  );
}
