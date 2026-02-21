import { startOfWeek, endOfWeek, getISOWeek } from 'date-fns';

export type PeriodMode = 'month' | 'week' | 'year' | 'custom';

export function toStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function detectMode(dateFrom: string, dateTo: string): PeriodMode {
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

export function getLabel(
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

export function getMonthNames(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const name = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1));
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}

export function getMonthShort(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const name = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1));
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}

export function getDayHeaders(locale: string): string[] {
  // Monday = 2024-01-01, Tuesday = 2024-01-02, etc.
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, i + 1)),
  );
}
