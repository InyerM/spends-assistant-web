'use client';

import { Fragment, useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameMonth,
  getISOWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PeriodMode = 'month' | 'week' | 'year' | 'custom';

interface PeriodSelectorProps {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}

function getMonthNames(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1)),
  );
}

function getMonthShort(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1)),
  );
}

function getDayHeaders(locale: string): string[] {
  // Monday = 2024-01-01, Tuesday = 2024-01-02, etc.
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, i + 1)),
  );
}

function toStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function detectMode(dateFrom: string, dateTo: string): PeriodMode {
  const from = toDate(dateFrom);
  const to = toDate(dateTo);

  if (
    dateFrom.endsWith('-01-01') &&
    dateTo.endsWith('-12-31') &&
    dateFrom.slice(0, 4) === dateTo.slice(0, 4)
  ) {
    return 'year';
  }

  const lastOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  if (
    from.getDate() === 1 &&
    to.getDate() === lastOfMonth &&
    from.getMonth() === to.getMonth() &&
    from.getFullYear() === to.getFullYear()
  ) {
    return 'month';
  }

  const ws = startOfWeek(from, { weekStartsOn: 1 });
  const we = endOfWeek(from, { weekStartsOn: 1 });
  if (toStr(ws) === dateFrom && toStr(we) === dateTo) {
    return 'week';
  }

  return 'custom';
}

function getLabel(
  dateFrom: string,
  dateTo: string,
  mode: PeriodMode,
  monthNames: string[],
  monthShort: string[],
): string {
  const from = toDate(dateFrom);
  const to = toDate(dateTo);

  switch (mode) {
    case 'month':
      return `${monthNames[from.getMonth()]} ${from.getFullYear()}`;
    case 'week': {
      const fromMonth = monthShort[from.getMonth()];
      const toMonth = monthShort[to.getMonth()];
      return from.getMonth() === to.getMonth()
        ? `W${getISOWeek(from)} · ${fromMonth} ${from.getDate()} – ${to.getDate()}, ${from.getFullYear()}`
        : `W${getISOWeek(from)} · ${fromMonth} ${from.getDate()} – ${toMonth} ${to.getDate()}, ${to.getFullYear()}`;
    }
    case 'year':
      return String(from.getFullYear());
    case 'custom': {
      const fromMonth = monthShort[from.getMonth()];
      const toMonth = monthShort[to.getMonth()];
      return `${fromMonth} ${from.getDate()}, ${from.getFullYear()} – ${toMonth} ${to.getDate()}, ${to.getFullYear()}`;
    }
  }
}

export function PeriodSelector({
  dateFrom,
  dateTo,
  onChange,
}: PeriodSelectorProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const monthNames = useMemo(() => getMonthNames(locale), [locale]);
  const monthShort = useMemo(() => getMonthShort(locale), [locale]);
  const dayHeaders = useMemo(() => getDayHeaders(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PeriodMode>(() => detectMode(dateFrom, dateTo));
  const [popoverTab, setPopoverTab] = useState<PeriodMode>(mode);
  const [pickerYear, setPickerYear] = useState(() => toDate(dateFrom).getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(toDate(dateFrom)));
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const [decadeStart, setDecadeStart] = useState(
    () => Math.floor(toDate(dateFrom).getFullYear() / 10) * 10,
  );

  const label = getLabel(dateFrom, dateTo, mode, monthNames, monthShort);
  const fromDate = toDate(dateFrom);

  const handlePrev = (): void => {
    const from = toDate(dateFrom);
    switch (mode) {
      case 'month': {
        const prev = subMonths(from, 1);
        onChange(toStr(startOfMonth(prev)), toStr(endOfMonth(prev)));
        break;
      }
      case 'week': {
        const prev = subWeeks(from, 1);
        onChange(
          toStr(startOfWeek(prev, { weekStartsOn: 1 })),
          toStr(endOfWeek(prev, { weekStartsOn: 1 })),
        );
        break;
      }
      case 'year': {
        const y = from.getFullYear() - 1;
        onChange(`${y}-01-01`, `${y}-12-31`);
        break;
      }
      default:
        break;
    }
  };

  const handleNext = (): void => {
    const from = toDate(dateFrom);
    switch (mode) {
      case 'month': {
        const next = addMonths(from, 1);
        onChange(toStr(startOfMonth(next)), toStr(endOfMonth(next)));
        break;
      }
      case 'week': {
        const next = addWeeks(from, 1);
        onChange(
          toStr(startOfWeek(next, { weekStartsOn: 1 })),
          toStr(endOfWeek(next, { weekStartsOn: 1 })),
        );
        break;
      }
      case 'year': {
        const y = from.getFullYear() + 1;
        onChange(`${y}-01-01`, `${y}-12-31`);
        break;
      }
      default:
        break;
    }
  };

  const handleMonthPick = (m: number): void => {
    const d = new Date(pickerYear, m, 1);
    onChange(toStr(startOfMonth(d)), toStr(endOfMonth(d)));
    setMode('month');
    setOpen(false);
  };

  const handleWeekPick = (day: Date): void => {
    onChange(
      toStr(startOfWeek(day, { weekStartsOn: 1 })),
      toStr(endOfWeek(day, { weekStartsOn: 1 })),
    );
    setMode('week');
    setOpen(false);
  };

  const handleYearPick = (y: number): void => {
    onChange(`${y}-01-01`, `${y}-12-31`);
    setMode('year');
    setOpen(false);
  };

  const handleCustomApply = (): void => {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange(customFrom, customTo);
      setMode('custom');
      setOpen(false);
    }
  };

  const handleReset = (): void => {
    const now = new Date();
    onChange(toStr(startOfMonth(now)), toStr(endOfMonth(now)));
    setMode('month');
    setOpen(false);
  };

  const handleOpenChange = (o: boolean): void => {
    if (o) {
      const from = toDate(dateFrom);
      setPopoverTab(mode);
      setPickerYear(from.getFullYear());
      setCalendarMonth(startOfMonth(from));
      setCustomFrom(dateFrom);
      setCustomTo(dateTo);
      setDecadeStart(Math.floor(from.getFullYear() / 10) * 10);
    }
    setOpen(o);
  };

  const calDays = useMemo((): Date[] => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const weeks = useMemo((): Date[][] => {
    const result: Date[][] = [];
    for (let i = 0; i < calDays.length; i += 7) {
      result.push(calDays.slice(i, i + 7));
    }
    return result;
  }, [calDays]);

  const years = useMemo(
    (): number[] => Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i),
    [decadeStart],
  );

  return (
    <div className='flex items-center gap-1'>
      {mode !== 'custom' && (
        <Button
          variant='ghost'
          size='icon'
          className='h-9 w-9 cursor-pointer sm:h-8 sm:w-8'
          onClick={handlePrev}>
          <ChevronLeft className='h-4 w-4' />
        </Button>
      )}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button className='hover:bg-card-overlay flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-2 sm:py-1'>
            <Calendar className='text-muted-foreground h-3.5 w-3.5' />
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent className='w-auto min-w-[280px] p-3' align='start'>
          <Tabs value={popoverTab} onValueChange={(v): void => setPopoverTab(v as PeriodMode)}>
            <TabsList className='w-full'>
              <TabsTrigger value='custom' className='flex-1 cursor-pointer text-xs'>
                {t('periodCustom')}
              </TabsTrigger>
              <TabsTrigger value='week' className='flex-1 cursor-pointer text-xs'>
                {t('periodWeeks')}
              </TabsTrigger>
              <TabsTrigger value='month' className='flex-1 cursor-pointer text-xs'>
                {t('periodMonths')}
              </TabsTrigger>
              <TabsTrigger value='year' className='flex-1 cursor-pointer text-xs'>
                {t('periodYears')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value='month' className='mt-3'>
              <div className='mb-3 flex items-center justify-between'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => setPickerYear(pickerYear - 1)}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='text-sm font-semibold'>{pickerYear}</span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => setPickerYear(pickerYear + 1)}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
              <div className='grid grid-cols-3 gap-1'>
                {monthShort.map((name, i) => {
                  const isActive =
                    mode === 'month' &&
                    i === fromDate.getMonth() &&
                    pickerYear === fromDate.getFullYear();
                  return (
                    <button
                      key={name}
                      onClick={(): void => handleMonthPick(i)}
                      className={`cursor-pointer rounded-md px-2 py-2.5 text-sm transition-colors sm:py-1.5 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-card-overlay text-foreground'
                      }`}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value='week' className='mt-3'>
              <div className='mb-2 flex items-center justify-between'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => setCalendarMonth(subMonths(calendarMonth, 1))}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='text-sm font-semibold'>
                  {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => setCalendarMonth(addMonths(calendarMonth, 1))}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
              <div className='grid grid-cols-7 text-center'>
                {dayHeaders.map((d) => (
                  <div key={d} className='text-muted-foreground py-1 text-xs font-medium'>
                    {d}
                  </div>
                ))}
                {weeks.map((week) => {
                  const isSelected = mode === 'week' && toStr(week[0]) === dateFrom;
                  return (
                    <Fragment key={toStr(week[0])}>
                      {week.map((day, di) => (
                        <button
                          key={toStr(day)}
                          onClick={(): void => handleWeekPick(day)}
                          className={`cursor-pointer py-2.5 text-sm transition-colors sm:py-1.5 sm:text-xs ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-card-overlay'
                          } ${!isSameMonth(day, calendarMonth) ? 'opacity-40' : ''} ${
                            di === 0 ? 'rounded-l-md' : ''
                          } ${di === 6 ? 'rounded-r-md' : ''}`}>
                          {day.getDate()}
                        </button>
                      ))}
                    </Fragment>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value='year' className='mt-3'>
              <div className='mb-3 flex items-center justify-between'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => setDecadeStart(decadeStart - 10)}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='text-sm font-semibold'>
                  {decadeStart} – {decadeStart + 9}
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => setDecadeStart(decadeStart + 10)}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
              <div className='grid grid-cols-3 gap-1'>
                {years.map((y) => {
                  const isActive = mode === 'year' && y === fromDate.getFullYear();
                  const isOutside = y < decadeStart || y >= decadeStart + 10;
                  return (
                    <button
                      key={y}
                      onClick={(): void => handleYearPick(y)}
                      className={`cursor-pointer rounded-md px-2 py-2.5 text-sm transition-colors sm:py-1.5 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isOutside
                            ? 'text-muted-foreground hover:bg-card-overlay'
                            : 'hover:bg-card-overlay text-foreground'
                      }`}>
                      {y}
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value='custom' className='mt-3'>
              <div className='space-y-3'>
                <div className='space-y-1.5'>
                  <label className='text-muted-foreground text-xs font-medium'>
                    {t('periodFrom')}
                  </label>
                  <Input
                    type='date'
                    value={customFrom}
                    onChange={(e): void => setCustomFrom(e.target.value)}
                    className='h-9 text-sm'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-muted-foreground text-xs font-medium'>
                    {t('periodTo')}
                  </label>
                  <Input
                    type='date'
                    value={customTo}
                    onChange={(e): void => setCustomTo(e.target.value)}
                    className='h-9 text-sm'
                  />
                </div>
                <Button
                  onClick={handleCustomApply}
                  disabled={!customFrom || !customTo || customFrom > customTo}
                  className='w-full cursor-pointer'
                  size='sm'>
                  {tCommon('apply')}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className='border-border mt-3 border-t pt-3'>
            <Button
              variant='ghost'
              size='sm'
              className='w-full cursor-pointer text-xs'
              onClick={handleReset}>
              {t('resetToCurrentMonth')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {mode !== 'custom' && (
        <Button
          variant='ghost'
          size='icon'
          className='h-9 w-9 cursor-pointer sm:h-8 sm:w-8'
          onClick={handleNext}>
          <ChevronRight className='h-4 w-4' />
        </Button>
      )}
    </div>
  );
}
