'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}

function formatYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DatePicker({ value, onChange, className }: DatePickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? parseISO(value) : undefined;

  const displayText = selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Pick a date';

  function handleSelect(date: Date): void {
    onChange(formatYYYYMMDD(date));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className={cn(
            'border-border flex h-11 w-full cursor-pointer items-center gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none sm:h-9',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            !value && 'text-muted-foreground',
            className,
          )}>
          <CalendarIcon className='h-4 w-4 shrink-0 opacity-50' />
          <span>{displayText}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-[320px] p-3' align='start'>
        <Calendar selected={selectedDate} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}
