export type AppField =
  | 'account'
  | 'date'
  | 'amount'
  | 'description'
  | 'type'
  | 'category'
  | 'notes'
  | 'payment_method'
  | 'transfer';

export interface FieldConfig {
  field: AppField;
  labelKey: string;
  required: boolean;
  aliases: string[];
}

export const FIELD_CONFIGS: FieldConfig[] = [
  {
    field: 'account',
    labelKey: 'fieldAccount',
    required: true,
    aliases: ['account', 'account_id'],
  },
  { field: 'date', labelKey: 'fieldDate', required: true, aliases: ['date'] },
  { field: 'amount', labelKey: 'fieldAmount', required: true, aliases: ['amount'] },
  {
    field: 'description',
    labelKey: 'fieldDescription',
    required: true,
    aliases: ['description', 'note'],
  },
  { field: 'type', labelKey: 'fieldType', required: true, aliases: ['type'] },
  {
    field: 'category',
    labelKey: 'fieldCategory',
    required: false,
    aliases: ['category', 'category_id'],
  },
  { field: 'notes', labelKey: 'fieldNotes', required: false, aliases: ['notes', 'note'] },
  {
    field: 'payment_method',
    labelKey: 'fieldPaymentMethod',
    required: false,
    aliases: ['payment_method', 'payment_type'],
  },
  { field: 'transfer', labelKey: 'fieldTransfer', required: false, aliases: ['transfer'] },
];

export const UNMAPPED = '__unmapped__';

export function buildAutoMapping(csvHeaders: string[]): Record<AppField, string> {
  const mapping: Record<AppField, string> = {} as Record<AppField, string>;
  const used = new Set<string>();

  for (const config of FIELD_CONFIGS) {
    const match = config.aliases.find((alias) => csvHeaders.includes(alias) && !used.has(alias));
    if (match) {
      mapping[config.field] = match;
      used.add(match);
    } else {
      mapping[config.field] = UNMAPPED;
    }
  }

  // If 'note' was mapped to description, don't also map it to notes
  if (mapping.description === 'note' && mapping.notes === 'note') {
    mapping.notes = UNMAPPED;
  }

  return mapping;
}

export interface TransformedRow {
  date: string;
  time: string;
  amount: number;
  description: string;
  notes: string | null;
  type: string;
  account: string;
  category: string | null;
  payment_method: string | null;
  source: string;
}

export function transformRow(
  row: Record<string, string>,
  mapping: Record<AppField, string>,
): TransformedRow {
  const get = (field: AppField): string => {
    const col = mapping[field];
    if (!col || col === UNMAPPED) return '';
    return row[col] ?? '';
  };

  const rawDate = get('date');
  let date = rawDate;
  let time = '12:00:00';

  // Handle ISO date strings like 2025-11-02T20:42:26.348Z
  if (rawDate.includes('T')) {
    const [datePart, timePart] = rawDate.split('T');
    date = datePart;
    time = timePart.replace('Z', '').split('.')[0];
  }

  const rawType = get('type').toLowerCase();
  const transferVal = get('transfer').toLowerCase();
  const type = transferVal === 'true' ? 'transfer' : rawType;

  return {
    date,
    time,
    amount: Math.abs(parseFloat(get('amount')) || 0),
    description: get('description'),
    notes: get('notes') || null,
    type,
    account: get('account'),
    category: get('category') || null,
    payment_method: get('payment_method').toLowerCase() || null,
    source: 'csv_import',
  };
}
