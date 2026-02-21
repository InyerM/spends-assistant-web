'use client';

import { Fragment, useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { startOfMonth, startOfWeek, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePeriodSelector } from '@/hooks/use-period-selector';
import {
  toStr,
  getMonthNames as getMonthNamesUtil,
  getMonthShort as getMonthShortUtil,
  getDayHeaders as getDayHeadersUtil,
  type PeriodMode,
} from '@/lib/utils/period';

interface PeriodSelectorProps {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}

export function PeriodSelector({
  dateFrom,
  dateTo,
  onChange,
}: PeriodSelectorProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  // Locale-aware month/day names for display
  const localeMonthNames = useMemo(() => getMonthNamesUtil(locale), [locale]);
  const localeMonthShort = useMemo(() => getMonthShortUtil(locale), [locale]);
  const localeDayHeaders = useMemo(() => getDayHeadersUtil(locale), [locale]);

  const period = usePeriodSelector({ dateFrom, dateTo, onChange });

  // Override label with localized "this month/week/year" when applicable
  const label = useMemo((): string => {
    const now = new Date();
    if (period.mode === 'month') {
      const nowStart = startOfMonth(now);
      if (
        period.fromDate.getFullYear() === nowStart.getFullYear() &&
        period.fromDate.getMonth() === nowStart.getMonth()
      ) {
        return t('thisMonth');
      }
    } else if (period.mode === 'week') {
      const nowWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      if (toStr(nowWeekStart) === dateFrom) {
        return t('thisWeek');
      }
    } else if (period.mode === 'year') {
      if (period.fromDate.getFullYear() === now.getFullYear()) {
        return t('thisYear');
      }
    }
    return period.label;
  }, [period.label, period.mode, period.fromDate, dateFrom, t]);

  const handleOpenChange = (o: boolean): void => {
    period.handleOpenChange(o);
    setOpen(o);
  };

  const handleMonthPick = (m: number): void => {
    period.handleMonthPick(m);
    setOpen(false);
  };

  const handleWeekPick = (day: Date): void => {
    period.handleWeekPick(day);
    setOpen(false);
  };

  const handleYearPick = (y: number): void => {
    period.handleYearPick(y);
    setOpen(false);
  };

  const handleCustomApply = (): void => {
    period.handleCustomApply();
    setOpen(false);
  };

  const handleReset = (): void => {
    period.handleReset();
    setOpen(false);
  };

  return (
    <div className='flex items-center gap-1'>
      {period.mode !== 'custom' && (
        <Button
          variant='ghost'
          size='icon'
          className='h-9 w-9 cursor-pointer sm:h-8 sm:w-8'
          onClick={period.handlePrev}>
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
          <Tabs
            value={period.popoverTab}
            onValueChange={(v): void => period.setPopoverTab(v as PeriodMode)}>
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
                  onClick={(): void => period.setPickerYear(period.pickerYear - 1)}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='text-sm font-semibold'>{period.pickerYear}</span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => period.setPickerYear(period.pickerYear + 1)}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
              <div className='grid grid-cols-3 gap-1'>
                {localeMonthShort.map((name, i) => {
                  const isActive =
                    period.mode === 'month' &&
                    i === period.fromDate.getMonth() &&
                    period.pickerYear === period.fromDate.getFullYear();
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
                  onClick={(): void => period.setCalendarMonth(subMonths(period.calendarMonth, 1))}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='text-sm font-semibold'>
                  {localeMonthNames[period.calendarMonth.getMonth()]}{' '}
                  {period.calendarMonth.getFullYear()}
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => period.setCalendarMonth(addMonths(period.calendarMonth, 1))}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
              <div className='grid grid-cols-7 text-center'>
                {localeDayHeaders.map((d) => (
                  <div key={d} className='text-muted-foreground py-1 text-xs font-medium'>
                    {d}
                  </div>
                ))}
                {period.weeks.map((week) => {
                  const isSelected = period.mode === 'week' && toStr(week[0]) === dateFrom;
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
                          } ${!isSameMonth(day, period.calendarMonth) ? 'opacity-40' : ''} ${
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
                  onClick={(): void => period.setDecadeStart(period.decadeStart - 10)}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <span className='text-sm font-semibold'>
                  {period.decadeStart} – {period.decadeStart + 9}
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 cursor-pointer'
                  onClick={(): void => period.setDecadeStart(period.decadeStart + 10)}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
              <div className='grid grid-cols-3 gap-1'>
                {period.years.map((y) => {
                  const isActive = period.mode === 'year' && y === period.fromDate.getFullYear();
                  const isOutside = y < period.decadeStart || y >= period.decadeStart + 10;
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
                  <DatePicker
                    value={period.customFrom}
                    onChange={period.setCustomFrom}
                    className='h-9 text-sm'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-muted-foreground text-xs font-medium'>
                    {t('periodTo')}
                  </label>
                  <DatePicker
                    value={period.customTo}
                    onChange={period.setCustomTo}
                    className='h-9 text-sm'
                  />
                </div>
                <Button
                  onClick={handleCustomApply}
                  disabled={
                    !period.customFrom || !period.customTo || period.customFrom > period.customTo
                  }
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
      {period.mode !== 'custom' && (
        <Button
          variant='ghost'
          size='icon'
          className='h-9 w-9 cursor-pointer sm:h-8 sm:w-8'
          onClick={period.handleNext}>
          <ChevronRight className='h-4 w-4' />
        </Button>
      )}
    </div>
  );
}
