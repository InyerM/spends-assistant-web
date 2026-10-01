/** Converts a reviewed decimal input to an exact JSON-safe integer string. */
export function parseDecimalUnits(value: string, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) throw new Error('invalid scale');
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error('invalid decimal amount');
  const fraction = match.at(2) ?? '';
  if (fraction.length > scale) throw new Error('amount exceeds supported precision');
  const atoms = BigInt(`${match[1]}${fraction.padEnd(scale, '0')}`).toString();
  if (atoms.length > 38) throw new Error('amount exceeds supported range');
  return atoms;
}

export function formatDecimalUnits(value: string, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) throw new Error('invalid scale');
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('invalid integer units');
  if (scale === 0) return value;
  const padded = value.padStart(scale + 1, '0');
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/** Formats exact integer units for display without converting money to a floating point number. */
export function formatLocalizedDecimalUnits(value: string, scale: number, locale: string): string {
  const decimal = formatDecimalUnits(value, scale);
  const [whole, fraction] = decimal.split('.');
  const formatter = new Intl.NumberFormat(locale);
  const grouped = formatter.format(BigInt(whole));
  if (!fraction) return grouped;
  const separator =
    formatter.formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  return `${grouped}${separator}${fraction}`;
}
