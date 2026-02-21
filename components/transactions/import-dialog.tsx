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
import { useUsage, usageKeys } from '@/hooks/use-usage';
import { useSubscription } from '@/hooks/use-subscription';
import { Upload, FileText, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCsv } from '@/lib/utils/csv';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'map' | 'preview' | 'duplicates';

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
  import_id?: string;
}

interface DuplicateMatch {
  index: number;
  match: { id: string; date: string; amount: number; description: string; account_id: string };
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<AppField, string>>({} as Record<AppField, string>);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const parsedRowsRef = useRef<Record<string, string>[]>([]);
  const { data: usage } = useUsage();
  const { data: subscription } = useSubscription();

  const resetState = (): void => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setMapping({} as Record<AppField, string>);
    setDuplicates([]);
    setIsChecking(false);
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

  const isFree = subscription?.plan !== 'pro';
  const importCount = parsedRowsRef.current.length;
  const txRemaining =
    usage && isFree ? Math.max(0, usage.transactions_limit - usage.transactions_count) : Infinity;
  const importExceedsLimit = isFree && importCount > txRemaining;

  const doImport = async (force: boolean, skipIndices?: Set<number>): Promise<void> => {
    setIsImporting(true);
    try {
      let transactions = parsedRowsRef.current.map((row) => transformRow(row, mapping));

      if (skipIndices && skipIndices.size > 0) {
        transactions = transactions.filter((_, i) => !skipIndices.has(i));
      }

      if (transactions.length === 0) {
        toast.info(t('noTransactions'));
        onOpenChange(false);
        resetState();
        return;
      }

      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          resolve_names: true,
          file_name: file?.name ?? 'import.csv',
          row_count: parsedRowsRef.current.length,
          force,
        }),
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

      // Upload CSV file to Supabase storage in the background
      if (file && result.import_id) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('import_id', result.import_id);
        void fetch('/api/transactions/imports', {
          method: 'POST',
          body: formData,
        });
      }

      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      void queryClient.invalidateQueries({ queryKey: usageKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['imports'] });

      toast(t('importHistory'), {
        action: {
          label: tCommon('more'),
          onClick: (): void => {
            window.location.href = '/transactions/imports';
          },
        },
      });

      onOpenChange(false);
      resetState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async (): Promise<void> => {
    if (parsedRowsRef.current.length === 0) return;

    // Check for duplicates first
    setIsChecking(true);
    try {
      const transactions = parsedRowsRef.current.map((row) => transformRow(row, mapping));
      const checkPayload = transactions.map((tx) => ({
        date: tx.date,
        amount: tx.amount,
        account: tx.account,
      }));

      const res = await fetch('/api/transactions/import/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: checkPayload }),
      });

      if (res.ok) {
        const result = (await res.json()) as { duplicates: DuplicateMatch[] };
        if (result.duplicates.length > 0) {
          setDuplicates(result.duplicates);
          setStep('duplicates');
          return;
        }
      }
      // If check fails or no duplicates, proceed directly
    } catch {
      // If duplicate check fails, proceed anyway
    } finally {
      setIsChecking(false);
    }

    await doImport(false);
  };

  const handleSkipDuplicates = async (): Promise<void> => {
    const skipIndices = new Set(duplicates.map((d) => d.index));
    await doImport(false, skipIndices);
  };

  const handleImportAllAnyway = async (): Promise<void> => {
    await doImport(true);
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
        onDragOver={(e): void => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragEnter={(e): void => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e): void => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e): void => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const droppedFile = e.dataTransfer.files[0];
          if (droppedFile.name.endsWith('.csv')) {
            void handleFileSelect(droppedFile);
          } else {
            toast.error(t('csvEmptyError'));
          }
        }}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-card-overlay',
        )}>
        <Upload className='text-muted-foreground h-8 w-8' />
        <span className='text-muted-foreground text-sm'>{t('dragDropCsv')}</span>
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

      <div className='border-border max-h-64 overflow-auto rounded border'>
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

      {importExceedsLimit && (
        <div className='border-destructive/30 bg-destructive/5 flex items-center gap-2 rounded-lg border p-3'>
          <AlertTriangle className='text-destructive h-4 w-4 shrink-0' />
          <p className='text-destructive text-sm'>
            {t('importLimitExceeded', { remaining: txRemaining })}
          </p>
        </div>
      )}

      <div className='flex justify-between'>
        <Button variant='outline' onClick={(): void => setStep('map')}>
          <ArrowLeft className='mr-1 h-4 w-4' />
          {tCommon('back')}
        </Button>
        <Button
          onClick={(): void => void handleImport()}
          disabled={isImporting || isChecking || importExceedsLimit}
          className='cursor-pointer'>
          {isChecking
            ? t('checking')
            : isImporting
              ? tCommon('importing')
              : t('importCount', { count: parsedRowsRef.current.length })}
        </Button>
      </div>
    </div>
  );

  const renderDuplicatesStep = (): React.ReactElement => (
    <div className='space-y-4'>
      <div className='border-warning/30 bg-warning/5 flex items-center gap-2 rounded-lg border p-3'>
        <AlertTriangle className='text-warning h-4 w-4 shrink-0' />
        <div>
          <p className='text-sm font-medium'>{t('duplicatesFound')}</p>
          <p className='text-muted-foreground text-sm'>
            {t('duplicatesDescription', { count: duplicates.length })}
          </p>
        </div>
      </div>

      <div className='border-border max-h-48 overflow-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t('date')}</TableHead>
              <TableHead>{t('description')}</TableHead>
              <TableHead className='text-right'>{t('amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {duplicates.map((dup) => (
              <TableRow key={dup.index}>
                <TableCell className='text-muted-foreground text-xs'>{dup.index + 1}</TableCell>
                <TableCell className='text-xs'>{dup.match.date}</TableCell>
                <TableCell className='max-w-[150px] truncate text-xs'>
                  {dup.match.description}
                </TableCell>
                <TableCell className='text-right text-xs'>
                  {dup.match.amount.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:justify-between'>
        <Button variant='outline' onClick={(): void => setStep('preview')}>
          <ArrowLeft className='mr-1 h-4 w-4' />
          {tCommon('back')}
        </Button>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            className='cursor-pointer'
            onClick={(): void => void handleSkipDuplicates()}
            disabled={isImporting}>
            {t('skipDuplicates')}
          </Button>
          <Button
            className='cursor-pointer'
            onClick={(): void => void handleImportAllAnyway()}
            disabled={isImporting}>
            {isImporting ? tCommon('importing') : t('importAllAnyway')}
          </Button>
        </div>
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
                —{' '}
                {step === 'map'
                  ? t('mapColumns')
                  : step === 'duplicates'
                    ? t('duplicatesFound')
                    : t('preview')}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && renderUploadStep()}
        {step === 'map' && renderMapStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'duplicates' && renderDuplicatesStep()}
      </DialogContent>
    </Dialog>
  );
}
