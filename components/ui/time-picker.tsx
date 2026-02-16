'use client';

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  className?: string;
}

function parse24h(value: string): { hours: number; minutes: number } {
  const parts = value.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return {
    hours: isNaN(h) ? 0 : Math.max(0, Math.min(23, h)),
    minutes: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  };
}

function to12h(hours24: number): { hours12: number; period: 'AM' | 'PM' } {
  const period: 'AM' | 'PM' = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return { hours12, period };
}

function to24h(hours12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hours12 === 12 ? 0 : hours12;
  return hours12 === 12 ? 12 : hours12 + 12;
}

function formatTime(hours24: number, minutes: number): string {
  return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function TimePicker({ value, onChange, className }: TimePickerProps): React.ReactElement {
  const { hours, minutes } = useMemo(() => parse24h(value), [value]);
  const { hours12, period } = to12h(hours);

  function handleHoursChange(raw: string): void {
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;
    const clamped = Math.max(1, Math.min(12, num));
    const h24 = to24h(clamped, period);
    onChange(formatTime(h24, minutes));
  }

  function handleMinutesChange(raw: string): void {
    const num = parseInt(raw, 10);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(59, num));
    onChange(formatTime(hours, clamped));
  }

  function togglePeriod(): void {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    const h24 = to24h(hours12, newPeriod);
    onChange(formatTime(h24, minutes));
  }

  return (
    <div
      className={cn(
        'border-border flex h-11 w-full items-center rounded-md border bg-transparent',
        'shadow-xs transition-[color,box-shadow] outline-none sm:h-9',
        'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
        className,
      )}>
      <Clock className='text-muted-foreground ml-3 h-4 w-4 shrink-0 opacity-50' />
      <input
        type='number'
        inputMode='numeric'
        min={1}
        max={12}
        value={hours12}
        onChange={(e): void => handleHoursChange(e.target.value)}
        className={cn(
          'h-full w-10 shrink-0 border-0 bg-transparent text-center font-mono text-sm outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
          '[&::-webkit-outer-spin-button]:appearance-none',
        )}
        aria-label='Hours'
      />
      <span className='text-muted-foreground shrink-0 font-mono text-sm font-bold'>:</span>
      <input
        type='number'
        inputMode='numeric'
        min={0}
        max={59}
        value={String(minutes).padStart(2, '0')}
        onChange={(e): void => handleMinutesChange(e.target.value)}
        className={cn(
          'h-full w-10 shrink-0 border-0 bg-transparent text-center font-mono text-sm outline-none',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
          '[&::-webkit-outer-spin-button]:appearance-none',
        )}
        aria-label='Minutes'
      />
      <div className='mr-1.5 ml-auto flex shrink-0'>
        <button
          type='button'
          onClick={togglePeriod}
          className={cn(
            'flex h-7 cursor-pointer items-center rounded px-2 font-mono text-xs font-medium',
            'transition-colors sm:h-6',
            'bg-accent text-accent-foreground hover:bg-accent/80',
          )}
          aria-label={`Toggle AM/PM, currently ${period}`}>
          {period}
        </button>
      </div>
    </div>
  );
}
