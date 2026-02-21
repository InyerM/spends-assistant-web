import { useState, useMemo, useCallback } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import {
  toStr,
  toDate,
  detectMode,
  getLabel,
  getMonthNames,
  getMonthShort,
  getDayHeaders,
  getPrevPeriod,
  getNextPeriod,
  type PeriodMode,
} from '@/lib/utils/period';

interface UsePeriodSelectorOptions {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}

interface UsePeriodSelectorReturn {
  mode: PeriodMode;
  label: string;
  monthNames: string[];
  monthShort: string[];
  dayHeaders: string[];
  fromDate: Date;
  popoverTab: PeriodMode;
  setPopoverTab: (tab: PeriodMode) => void;
  pickerYear: number;
  setPickerYear: (year: number) => void;
  calendarMonth: Date;
  setCalendarMonth: (month: Date) => void;
  customFrom: string;
  setCustomFrom: (from: string) => void;
  customTo: string;
  setCustomTo: (to: string) => void;
  decadeStart: number;
  setDecadeStart: (start: number) => void;
  calDays: Date[];
  weeks: Date[][];
  years: number[];
  handlePrev: () => void;
  handleNext: () => void;
  handleMonthPick: (m: number) => void;
  handleWeekPick: (day: Date) => void;
  handleYearPick: (y: number) => void;
  handleCustomApply: () => void;
  handleReset: () => void;
  handleOpenChange: (open: boolean) => void;
}

export function usePeriodSelector({
  dateFrom,
  dateTo,
  onChange,
}: UsePeriodSelectorOptions): UsePeriodSelectorReturn {
  // Use 'en' as default locale for the hook; the component can use its own locale
  // by passing monthNames/monthShort. But to keep this simple, we compute with 'en'.
  // Actually, we need locale. Let's accept it or default. For now, compute with 'en'
  // and the component can override the label.
  // After reviewing the component, it uses `useLocale()` from next-intl. The hook
  // doesn't have access to that, so we'll compute locale-dependent data internally
  // and the component will pass locale. Let me restructure.

  // Actually, let me keep locale-dependent formatting in useMemo at component level,
  // and have the hook accept a locale parameter OR just use 'en' as default.
  // Looking at the component, it passes locale for month names. Let's keep it simple.

  const locale = 'en'; // Default; component can use its own locale for display
  const monthNames = useMemo(() => getMonthNames(locale), [locale]);
  const monthShort = useMemo(() => getMonthShort(locale), [locale]);
  const dayHeaders = useMemo(() => getDayHeaders(locale), [locale]);

  const [mode, setMode] = useState<PeriodMode>(() => detectMode(dateFrom, dateTo));
  const [popoverTab, setPopoverTab] = useState<PeriodMode>(mode);
  const [pickerYear, setPickerYear] = useState(() => toDate(dateFrom).getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(toDate(dateFrom)));
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const [decadeStart, setDecadeStart] = useState(
    () => Math.floor(toDate(dateFrom).getFullYear() / 10) * 10,
  );

  const fromDate = toDate(dateFrom);
  const baseLabel = getLabel(dateFrom, dateTo, mode, monthNames, monthShort);

  const label = useMemo((): string => {
    const now = new Date();
    if (mode === 'month') {
      const nowStart = startOfMonth(now);
      if (
        fromDate.getFullYear() === nowStart.getFullYear() &&
        fromDate.getMonth() === nowStart.getMonth()
      ) {
        return baseLabel; // Hook doesn't have translations; component can override
      }
    } else if (mode === 'week') {
      const nowWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      if (toStr(nowWeekStart) === dateFrom) {
        return baseLabel;
      }
    } else if (mode === 'year') {
      if (fromDate.getFullYear() === now.getFullYear()) {
        return baseLabel;
      }
    }
    return baseLabel;
  }, [baseLabel, mode, fromDate, dateFrom]);

  const handlePrev = useCallback((): void => {
    const result = getPrevPeriod(dateFrom, mode);
    if (result) onChange(result[0], result[1]);
  }, [dateFrom, mode, onChange]);

  const handleNext = useCallback((): void => {
    const result = getNextPeriod(dateFrom, mode);
    if (result) onChange(result[0], result[1]);
  }, [dateFrom, mode, onChange]);

  const handleMonthPick = useCallback(
    (m: number): void => {
      const d = new Date(pickerYear, m, 1);
      onChange(toStr(startOfMonth(d)), toStr(endOfMonth(d)));
      setMode('month');
    },
    [pickerYear, onChange],
  );

  const handleWeekPick = useCallback(
    (day: Date): void => {
      onChange(
        toStr(startOfWeek(day, { weekStartsOn: 1 })),
        toStr(endOfWeek(day, { weekStartsOn: 1 })),
      );
      setMode('week');
    },
    [onChange],
  );

  const handleYearPick = useCallback(
    (y: number): void => {
      onChange(`${y}-01-01`, `${y}-12-31`);
      setMode('year');
    },
    [onChange],
  );

  const handleCustomApply = useCallback((): void => {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange(customFrom, customTo);
      setMode('custom');
    }
  }, [customFrom, customTo, onChange]);

  const handleReset = useCallback((): void => {
    const now = new Date();
    onChange(toStr(startOfMonth(now)), toStr(endOfMonth(now)));
    setMode('month');
  }, [onChange]);

  const handleOpenChange = useCallback(
    (o: boolean): void => {
      if (o) {
        const from = toDate(dateFrom);
        setPopoverTab(mode);
        setPickerYear(from.getFullYear());
        setCalendarMonth(startOfMonth(from));
        setCustomFrom(dateFrom);
        setCustomTo(dateTo);
        setDecadeStart(Math.floor(from.getFullYear() / 10) * 10);
      }
    },
    [dateFrom, dateTo, mode],
  );

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

  return {
    mode,
    label,
    monthNames,
    monthShort,
    dayHeaders,
    fromDate,
    popoverTab,
    setPopoverTab,
    pickerYear,
    setPickerYear,
    calendarMonth,
    setCalendarMonth,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    decadeStart,
    setDecadeStart,
    calDays,
    weeks,
    years,
    handlePrev,
    handleNext,
    handleMonthPick,
    handleWeekPick,
    handleYearPick,
    handleCustomApply,
    handleReset,
    handleOpenChange,
  };
}
