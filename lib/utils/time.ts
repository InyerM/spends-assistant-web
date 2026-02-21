export function parse24h(value: string): { hours: number; minutes: number } {
  const parts = value.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return {
    hours: isNaN(h) ? 0 : Math.max(0, Math.min(23, h)),
    minutes: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  };
}

export function to12h(hours24: number): { hours12: number; period: 'AM' | 'PM' } {
  const period: 'AM' | 'PM' = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return { hours12, period };
}

export function to24h(hours12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hours12 === 12 ? 0 : hours12;
  return hours12 === 12 ? 12 : hours12 + 12;
}

export function formatTime(hours24: number, minutes: number): string {
  return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Returns true if the partial input could lead to a valid hours value. */
export function isValidHoursInput(val: string, is24h: boolean): boolean {
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
export function isValidMinutesInput(val: string): boolean {
  if (val === '') return true;
  const num = parseInt(val, 10);
  if (isNaN(num)) return false;
  if (val.length === 1) return num <= 9;
  return num <= 59;
}
