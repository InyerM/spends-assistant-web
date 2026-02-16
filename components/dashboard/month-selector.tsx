'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function getMonthNames(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const name = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1));
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}

function getMonthShort(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const name = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1));
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}

interface MonthSelectorProps {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthSelector({ year, month, onChange }: MonthSelectorProps): React.ReactElement {
  const locale = useLocale();
  const monthNames = useMemo(() => getMonthNames(locale), [locale]);
  const monthShort = useMemo(() => getMonthShort(locale), [locale]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  const handlePrev = (): void => {
    if (month === 0) {
      onChange(year - 1, 11);
    } else {
      onChange(year, month - 1);
    }
  };

  const handleNext = (): void => {
    if (month === 11) {
      onChange(year + 1, 0);
    } else {
      onChange(year, month + 1);
    }
  };

  const handleMonthPick = (m: number): void => {
    onChange(pickerYear, m);
    setPickerOpen(false);
  };

  const handlePickerOpen = (open: boolean): void => {
    if (open) setPickerYear(year);
    setPickerOpen(open);
  };

  return (
    <div className='flex items-center gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='h-9 w-9 cursor-pointer sm:h-8 sm:w-8'
        onClick={handlePrev}>
        <ChevronLeft className='h-4 w-4' />
      </Button>
      <Popover open={pickerOpen} onOpenChange={handlePickerOpen}>
        <PopoverTrigger asChild>
          <button className='hover:bg-card-overlay min-w-[140px] cursor-pointer rounded-md px-2 py-1 text-center text-sm font-medium transition-colors'>
            {monthNames[month]} {year}
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-64 p-3' align='center'>
          <div className='mb-3 flex items-center justify-between'>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 cursor-pointer'
              onClick={(): void => setPickerYear(pickerYear - 1)}>
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <span className='text-sm font-semibold'>{pickerYear}</span>
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 cursor-pointer'
              onClick={(): void => setPickerYear(pickerYear + 1)}>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
          <div className='grid grid-cols-3 gap-1'>
            {monthShort.map((name, i) => (
              <button
                key={name}
                onClick={(): void => handleMonthPick(i)}
                className={`cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors ${
                  i === month && pickerYear === year
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-card-overlay text-foreground'
                }`}>
                {name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant='ghost'
        size='icon'
        className='h-9 w-9 cursor-pointer sm:h-8 sm:w-8'
        onClick={handleNext}>
        <ChevronRight className='h-4 w-4' />
      </Button>
    </div>
  );
}
