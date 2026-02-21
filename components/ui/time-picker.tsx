'use client';

import { useRef, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserSettings } from '@/hooks/use-user-settings';

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

/** Returns true if the partial input could lead to a valid hours value. */
function isValidHoursInput(val: string, is24h: boolean): boolean {
  if (val === '') return true;
  const num = parseInt(val, 10);
  if (isNaN(num)) return false;
  if (val.length === 1) {
    // Single digit: allow if it could be a valid value or prefix
    // 12h: 0 (prefix for 01-09), 1 (value or prefix for 10-12), 2-9 (values)
    // 24h: 0-2 (values or prefixes), 3-9 (values)
    return is24h ? num <= 9 : num <= 9;
  }
  // Two digits: must be in valid range
  return is24h ? num <= 23 : num >= 1 && num <= 12;
}

/** Returns true if the partial input could lead to a valid minutes value. */
function isValidMinutesInput(val: string): boolean {
  if (val === '') return true;
  const num = parseInt(val, 10);
  if (isNaN(num)) return false;
  if (val.length === 1) return num <= 9;
  return num <= 59;
}

export function TimePicker({ value, onChange, className }: TimePickerProps): React.ReactElement {
  const { hours, minutes } = useMemo(() => parse24h(value), [value]);
  const { hours12, period } = to12h(hours);
  const { data: userSettings } = useUserSettings();
  const is24h = userSettings?.hour_format === '24h';
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const periodRef = useRef<HTMLButtonElement>(null);

  const displayHours = is24h ? String(hours).padStart(2, '0') : String(hours12);
  const displayMinutes = String(minutes).padStart(2, '0');

  const [hoursText, setHoursText] = useState(displayHours);
  const [minutesText, setMinutesText] = useState(displayMinutes);
  const [isEditingHours, setIsEditingHours] = useState(false);
  const [isEditingMinutes, setIsEditingMinutes] = useState(false);

  // Sync local state when external value changes and not editing
  // (React-recommended pattern: adjust state during render instead of in an effect)
  const [prevDisplayHours, setPrevDisplayHours] = useState(displayHours);
  if (displayHours !== prevDisplayHours) {
    setPrevDisplayHours(displayHours);
    if (!isEditingHours) setHoursText(displayHours);
  }

  const [prevDisplayMinutes, setPrevDisplayMinutes] = useState(displayMinutes);
  if (displayMinutes !== prevDisplayMinutes) {
    setPrevDisplayMinutes(displayMinutes);
    if (!isEditingMinutes) setMinutesText(displayMinutes);
  }

  function commitHours(raw: string): void {
    const num = parseInt(raw, 10);
    if (isNaN(num)) {
      setHoursText(displayHours);
      return;
    }
    if (is24h) {
      const clamped = Math.max(0, Math.min(23, num));
      onChange(formatTime(clamped, minutes));
    } else {
      const clamped = Math.max(1, Math.min(12, num));
      const h24 = to24h(clamped, period);
      onChange(formatTime(h24, minutes));
    }
  }

  function commitMinutes(raw: string): void {
    const num = parseInt(raw, 10);
    if (isNaN(num)) {
      setMinutesText(displayMinutes);
      return;
    }
    const clamped = Math.max(0, Math.min(59, num));
    onChange(formatTime(hours, clamped));
  }

  function togglePeriod(): void {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    const h24 = to24h(hours12, newPeriod);
    onChange(formatTime(h24, minutes));
  }

  function handleHoursKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (is24h) {
        const next = hours >= 23 ? 0 : hours + 1;
        onChange(formatTime(next, minutes));
      } else {
        const next = hours12 >= 12 ? 1 : hours12 + 1;
        const h24 = to24h(next, period);
        onChange(formatTime(h24, minutes));
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (is24h) {
        const next = hours <= 0 ? 23 : hours - 1;
        onChange(formatTime(next, minutes));
      } else {
        const next = hours12 <= 1 ? 12 : hours12 - 1;
        const h24 = to24h(next, period);
        onChange(formatTime(h24, minutes));
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      minutesRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitHours(hoursText);
      setIsEditingHours(false);
      minutesRef.current?.focus();
    }
  }

  function handleMinutesKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = minutes >= 59 ? 0 : minutes + 1;
      onChange(formatTime(hours, next));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = minutes <= 0 ? 59 : minutes - 1;
      onChange(formatTime(hours, next));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!is24h) {
        periodRef.current?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      hoursRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commitMinutes(minutesText);
      setIsEditingMinutes(false);
    }
  }

  function handlePeriodKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      togglePeriod();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      minutesRef.current?.focus();
    }
  }

  const inputClassName = cn(
    'h-full w-10 shrink-0 border-0 bg-transparent text-center font-mono text-sm outline-none',
  );

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
        ref={hoursRef}
        type='text'
        inputMode='numeric'
        maxLength={2}
        value={hoursText}
        onChange={(e): void => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
          if (isValidHoursInput(val, is24h)) setHoursText(val);
        }}
        onFocus={(): void => {
          setIsEditingHours(true);
          hoursRef.current?.select();
        }}
        onBlur={(): void => {
          commitHours(hoursText);
          setIsEditingHours(false);
        }}
        onKeyDown={handleHoursKeyDown}
        className={inputClassName}
        aria-label='Hours'
      />
      <span className='text-muted-foreground shrink-0 font-mono text-sm font-bold'>:</span>
      <input
        ref={minutesRef}
        type='text'
        inputMode='numeric'
        maxLength={2}
        value={minutesText}
        onChange={(e): void => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 2);
          if (isValidMinutesInput(val)) setMinutesText(val);
        }}
        onFocus={(): void => {
          setIsEditingMinutes(true);
          minutesRef.current?.select();
        }}
        onBlur={(): void => {
          commitMinutes(minutesText);
          setIsEditingMinutes(false);
        }}
        onKeyDown={handleMinutesKeyDown}
        className={inputClassName}
        aria-label='Minutes'
      />
      {!is24h && (
        <div className='mr-1.5 ml-auto flex shrink-0'>
          <button
            ref={periodRef}
            type='button'
            onClick={togglePeriod}
            onKeyDown={handlePeriodKeyDown}
            className={cn(
              'flex h-7 cursor-pointer items-center rounded px-2 font-mono text-xs font-medium',
              'transition-colors sm:h-6',
              'bg-accent text-accent-foreground hover:bg-accent/80',
            )}
            aria-label={`Toggle AM/PM, currently ${period}`}>
            {period}
          </button>
        </div>
      )}
    </div>
  );
}
