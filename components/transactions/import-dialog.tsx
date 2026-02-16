'use client';

import { useState, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import { Upload, FileText, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'map' | 'preview';

type AppField =
  | 'account'
  | 'date'
  | 'amount'
  | 'description'
  | 'type'
  | 'category'
  | 'notes'
  | 'payment_method'
  | 'transfer';

interface FieldConfig {
  field: AppField;
  labelKey: string;
  required: boolean;
  aliases: string[];
}

const FIELD_CONFIGS: FieldConfig[] = [
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

const UNMAPPED = '__unmapped__';

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
} {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], delimiter: ',' };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });

  return { headers, rows, delimiter };
}

function buildAutoMapping(csvHeaders: string[]): Record<AppField, string> {
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

interface TransformedRow {
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

function transformRow(
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

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<AppField, string>>({} as Record<AppField, string>);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const parsedRowsRef = useRef<Record<string, string>[]>([]);

  const resetState = (): void => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setMapping({} as Record<AppField, string>);
    parsedRowsRef.current = [];
  };

  const handleFileSelect = async (selectedFile: File): Promise<void> => {
    setFile(selectedFile);
    const text = await selectedFile.text();
    const { headers, rows } = parseCsv(text);

    if (headers.length === 0 || rows.length === 0) {
      toast.error(t('csvEmptyError'));
      setFile(null);
      return;
    }

    parsedRowsRef.current = rows;
    setCsvHeaders(headers);
    setMapping(buildAutoMapping(headers));
    setStep('map');
  };

  const handleMappingChange = (field: AppField, csvColumn: string): void => {
    setMapping((prev) => ({ ...prev, [field]: csvColumn }));
  };

  const usedColumns = useMemo(() => {
    const used = new Set<string>();
    for (const col of Object.values(mapping)) {
      if (col !== UNMAPPED) used.add(col);
    }
    return used;
  }, [mapping]);

  const missingRequired = useMemo(
    () =>
      FIELD_CONFIGS.filter(
        (c) => c.required && (!mapping[c.field] || mapping[c.field] === UNMAPPED),
      ).map((c) => t(c.labelKey)),
    [mapping, t],
  );

  const previewRows = useMemo(
    () => parsedRowsRef.current.slice(0, 5).map((row) => transformRow(row, mapping)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapping, step],
  );

  const handleImport = async (): Promise<void> => {
    if (parsedRowsRef.current.length === 0) return;

    setIsImporting(true);
    try {
      const transactions = parsedRowsRef.current.map((row) => transformRow(row, mapping));

      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, resolve_names: true }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error: string }).error || 'Import failed');
      }

      const result = (await res.json()) as ImportResult;

      if (result.errors.length > 0) {
        toast.warning(
          `${t('importedCount', { count: result.imported })}, skipped ${result.skipped}: ${result.errors[0]}`,
        );
      } else {
        toast.success(t('importedCount', { count: result.imported }));
      }

      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      onOpenChange(false);
      resetState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const renderUploadStep = (): React.ReactElement => (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>{t('uploadDescription')}</p>

      <input
        ref={fileRef}
        type='file'
        accept='.csv'
        className='hidden'
        onChange={(e): void => {
          const f = e.target.files?.[0];
          if (f) void handleFileSelect(f);
        }}
      />

      <button
        onClick={(): void => fileRef.current?.click()}
        className='border-border hover:bg-card-overlay flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors'>
        <Upload className='text-muted-foreground h-8 w-8' />
        <span className='text-muted-foreground text-sm'>{t('clickToSelect')}</span>
      </button>

      <div className='flex justify-end'>
        <Button variant='outline' onClick={(): void => onOpenChange(false)}>
          {tCommon('cancel')}
        </Button>
      </div>
    </div>
  );

  const renderMapStep = (): React.ReactElement => (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <FileText className='text-muted-foreground h-4 w-4' />
        <span className='text-sm font-medium'>{file?.name}</span>
        <span className='text-muted-foreground text-xs'>
          ({parsedRowsRef.current.length} {t('rows')}, {csvHeaders.length} {t('columns')})
        </span>
      </div>

      <div className='space-y-2'>
        {FIELD_CONFIGS.map((config) => (
          <div
            key={config.field}
            className='flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3'>
            <span className='text-sm sm:w-32'>
              {t(config.labelKey)}
              {config.required && <span className='text-destructive ml-0.5'>*</span>}
            </span>
            <Select
              value={mapping[config.field]}
              onValueChange={(v): void => handleMappingChange(config.field, v)}>
              <SelectTrigger size='sm' className='w-full sm:w-48'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNMAPPED}>— {t('skip')} —</SelectItem>
                {csvHeaders.map((header) => (
                  <SelectItem
                    key={header}
                    value={header}
                    disabled={usedColumns.has(header) && mapping[config.field] !== header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {missingRequired.length > 0 && (
        <div className='text-destructive flex items-center gap-2 text-xs'>
          <AlertTriangle className='h-3.5 w-3.5' />
          {t('missingRequired', { fields: missingRequired.join(', ') })}
        </div>
      )}

      <div className='flex justify-between'>
        <Button variant='outline' onClick={(): void => resetState()}>
          <ArrowLeft className='mr-1 h-4 w-4' />
          {tCommon('back')}
        </Button>
        <Button
          disabled={missingRequired.length > 0}
          className='cursor-pointer'
          onClick={(): void => setStep('preview')}>
          {t('preview')}
          <ArrowRight className='ml-1 h-4 w-4' />
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = (): React.ReactElement => (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>
        {t('previewDescription', {
          shown: previewRows.length,
          total: parsedRowsRef.current.length,
        })}
      </p>

      <div className='max-h-64 overflow-auto rounded border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('date')}</TableHead>
              <TableHead className='hidden sm:table-cell'>{t('account')}</TableHead>
              <TableHead>{t('description')}</TableHead>
              <TableHead className='text-right'>{t('amount')}</TableHead>
              <TableHead>{t('type')}</TableHead>
              <TableHead className='hidden sm:table-cell'>{t('category')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewRows.map((row, i) => (
              <TableRow key={i}>
                <TableCell className='text-xs'>{row.date}</TableCell>
                <TableCell className='hidden text-xs sm:table-cell'>{row.account}</TableCell>
                <TableCell className='max-w-[120px] truncate text-xs sm:max-w-[150px]'>
                  {row.description}
                </TableCell>
                <TableCell className='text-right text-xs'>{row.amount.toLocaleString()}</TableCell>
                <TableCell className='text-xs'>{row.type}</TableCell>
                <TableCell className='hidden text-xs sm:table-cell'>
                  {row.category ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='flex justify-between'>
        <Button variant='outline' onClick={(): void => setStep('map')}>
          <ArrowLeft className='mr-1 h-4 w-4' />
          {tCommon('back')}
        </Button>
        <Button
          onClick={(): void => void handleImport()}
          disabled={isImporting}
          className='cursor-pointer'>
          {isImporting
            ? tCommon('importing')
            : t('importCount', { count: parsedRowsRef.current.length })}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v): void => {
        if (!v) resetState();
        onOpenChange(v);
      }}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>
            {t('importTransactions')}
            {step !== 'upload' && (
              <span className='text-muted-foreground ml-2 text-sm font-normal'>
                — {step === 'map' ? t('mapColumns') : t('preview')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && renderUploadStep()}
        {step === 'map' && renderMapStep()}
        {step === 'preview' && renderPreviewStep()}
      </DialogContent>
    </Dialog>
  );
}
