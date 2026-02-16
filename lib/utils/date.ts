import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const COLOMBIA_TIMEZONE = 'America/Bogota';

interface ColombiaTimes {
  date: string;
  time: string;
  datetime: string;
}

export function getCurrentColombiaTimes(): ColombiaTimes {
  const now = new Date();
  const colombiaDate = now.toLocaleDateString('en-CA', { timeZone: COLOMBIA_TIMEZONE });
  const colombiaTime = now.toLocaleTimeString('en-GB', {
    timeZone: COLOMBIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    date: colombiaDate,
    time: colombiaTime,
    datetime: `${colombiaDate}T${colombiaTime}`,
  };
}

export function formatDateForDisplay(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatTimeForDisplay(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '\u2014';
  try {
    return format(parseISO(isoString), 'd MMM yyyy, h:mm a', { locale: es });
  } catch {
    return isoString;
  }
}
