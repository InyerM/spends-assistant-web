'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { transactionKeys } from '@/lib/api/queries/transaction.queries';
import { Upload, FileText } from 'lucide-react';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCsvLine(line: string): string[] {
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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}

const REQUIRED_COLUMNS = ['date', 'amount', 'description', 'type', 'account_id', 'source'];

export function ImportDialog({ open, onOpenChange }: ImportDialogProps): React.ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rowCount: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const parsedRowsRef = useRef<Record<string, string>[]>([]);

  const handleFileSelect = async (selectedFile: File): Promise<void> => {
    setFile(selectedFile);
    const text = await selectedFile.text();
    const { headers, rows } = parseCsv(text);

    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missing.length > 0) {
      toast.error(`Missing required columns: ${missing.join(', ')}`);
      setFile(null);
      setPreview(null);
      return;
    }

    parsedRowsRef.current = rows;
    setPreview({ headers, rowCount: rows.length });
  };

  const handleImport = async (): Promise<void> => {
    if (parsedRowsRef.current.length === 0) return;

    setIsImporting(true);
    try {
      const transactions = parsedRowsRef.current.map((row) => ({
        date: row.date,
        time: row.time || '00:00:00',
        amount: parseFloat(row.amount),
        description: row.description,
        notes: row.notes || null,
        type: row.type,
        account_id: row.account_id,
        category_id: row.category_id || null,
        payment_method: row.payment_method || null,
        source: row.source || 'csv_import',
      }));

      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error((error as { error: string }).error || 'Import failed');
      }

      const result = (await res.json()) as { imported: number };
      toast.success(`Imported ${result.imported} transactions`);
      void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      onOpenChange(false);
      setFile(null);
      setPreview(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            Upload a CSV file with the following columns: <br />
            <code className='text-foreground text-xs'>
              date, time, amount, description, type, account_id, source
            </code>
            <br />
            Optional: <code className='text-xs'>notes, category_id, payment_method</code>
          </p>

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

          {!file ? (
            <button
              onClick={(): void => fileRef.current?.click()}
              className='border-border hover:bg-card-overlay flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors'>
              <Upload className='text-muted-foreground h-8 w-8' />
              <span className='text-muted-foreground text-sm'>Click to select a CSV file</span>
            </button>
          ) : (
            <div className='border-border flex items-center gap-3 rounded-lg border p-3'>
              <FileText className='text-muted-foreground h-8 w-8' />
              <div className='min-w-0 flex-1'>
                <p className='text-foreground truncate text-sm font-medium'>{file.name}</p>
                {preview && (
                  <p className='text-muted-foreground text-xs'>
                    {preview.rowCount} rows · {preview.headers.length} columns
                  </p>
                )}
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='cursor-pointer'
                onClick={(): void => {
                  setFile(null);
                  setPreview(null);
                }}>
                Change
              </Button>
            </div>
          )}

          <div className='flex justify-end gap-3'>
            <Button variant='outline' onClick={(): void => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={(): void => void handleImport()}
              disabled={!preview || isImporting}
              className='cursor-pointer'>
              {isImporting ? 'Importing...' : `Import ${preview?.rowCount ?? 0} transactions`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
