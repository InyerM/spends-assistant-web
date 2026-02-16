'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  className?: string;
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function buildCalendarGrid(year: number, month: number, selected?: Date): DayCell[] {
  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = getDaysInMonth(year, month);
  const daysInPrevMonth =
    month === 0 ? getDaysInMonth(year - 1, 11) : getDaysInMonth(year, month - 1);
  const cells: DayCell[] = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = new Date(year, month - 1, day);
    cells.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: selected ? isSameDay(date, selected) : false,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      isSelected: selected ? isSameDay(date, selected) : false,
    });
  }

  // Next month leading days
  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    const date = new Date(year, month + 1, day);
    cells.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      isSelected: selected ? isSameDay(date, selected) : false,
    });
  }

  return cells;
}

export function Calendar({ selected, onSelect, className }: CalendarProps): React.ReactElement {
  const initialDate = selected ?? new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const cells = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth, selected),
    [viewYear, viewMonth, selected],
  );

  function handlePrevMonth(): void {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth(): void {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handleSelect(cell: DayCell): void {
    onSelect?.(cell.date);
  }

  return (
    <div className={cn('w-full', className)}>
      <div className='mb-3 flex items-center justify-between'>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className='cursor-pointer'
          onClick={handlePrevMonth}>
          <ChevronLeft className='h-5 w-5' />
        </Button>
        <span className='text-base font-medium'>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className='cursor-pointer'
          onClick={handleNextMonth}>
          <ChevronRight className='h-5 w-5' />
        </Button>
      </div>

      <div className='grid grid-cols-7 gap-0'>
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className='text-muted-foreground flex h-10 items-center justify-center text-sm font-medium'>
            {label}
          </div>
        ))}
        {cells.map((cell, i) => (
          <button
            key={i}
            type='button'
            className={cn(
              'flex h-10 w-full cursor-pointer items-center justify-center rounded-md text-base transition-colors',
              !cell.isCurrentMonth && 'text-muted-foreground/40',
              cell.isCurrentMonth && !cell.isSelected && 'text-foreground hover:bg-accent',
              cell.isToday && !cell.isSelected && 'font-bold',
              cell.isSelected && 'bg-primary text-primary-foreground',
            )}
            onClick={(): void => handleSelect(cell)}>
            {cell.date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
