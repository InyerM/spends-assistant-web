'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Pencil } from 'lucide-react';
import { useCreateTransaction } from '@/lib/api/mutations/transaction.mutations';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import type { Transaction } from '@/types';

interface ParsedExpense {
  amount: number;
  description: string;
  category: string;
  original_date?: string | null;
  original_time?: string | null;
  confidence: number;
  payment_type?: string;
  bank?: string;
  type?: string;
}

interface ParseResponse {
  parsed: ParsedExpense;
  resolved: {
    account_id?: string;
    category_id?: string;
  };
}

function parseDateString(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  let year = parts[2];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function parseTimeString(timeStr: string): string {
  return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
}

interface AiParseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiParseDialog({ open, onOpenChange }: AiParseDialogProps): React.ReactElement {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const createMutation = useCreateTransaction();
  const { openWith } = useTransactionFormStore();

  function resetState(): void {
    setText('');
    setResult(null);
  }

  function handleClose(next: boolean): void {
    if (!next) resetState();
    onOpenChange(next);
  }

  function buildTransactionFields(): {
    date: string;
    time: string;
    amount: number;
    description: string;
    type: string;
    account_id: string;
    category_id: string | undefined;
    payment_method: string | undefined;
  } | null {
    if (!result) return null;
    const { parsed, resolved } = result;
    const times = getCurrentColombiaTimes();

    const date = parsed.original_date ? parseDateString(parsed.original_date) : times.date;
    const time = parsed.original_time ? parseTimeString(parsed.original_time) : times.time;
    const type =
      parsed.type === 'transfer' ? 'transfer' : parsed.type === 'income' ? 'income' : 'expense';

    return {
      date,
      time,
      amount: parsed.amount,
      description: parsed.description,
      type,
      account_id: resolved.account_id ?? '',
      category_id: resolved.category_id,
      payment_method: parsed.payment_type,
    };
  }

  async function handleParse(): Promise<void> {
    if (!text.trim()) return;
    setParsing(true);
    setResult(null);
    try {
      const res = await fetch('/api/transactions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Parse failed' }));
        throw new Error((err as { error: string }).error);
      }
      const data = (await res.json()) as ParseResponse;
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse');
    } finally {
      setParsing(false);
    }
  }

  async function handleQuickCreate(): Promise<void> {
    const fields = buildTransactionFields();
    if (!fields || !result) return;

    try {
      await createMutation.mutateAsync({
        ...fields,
        type: fields.type as 'expense' | 'income' | 'transfer',
        source: 'web-ai',
        raw_text: text,
        confidence: result.parsed.confidence,
        parsed_data: result.parsed as unknown as Record<string, unknown>,
      });
      toast.success('Transaction created from AI');
      resetState();
    } catch {
      toast.error('Failed to create transaction');
    }
  }

  async function handleQuickCreateAndAnother(): Promise<void> {
    const fields = buildTransactionFields();
    if (!fields || !result) return;

    try {
      await createMutation.mutateAsync({
        ...fields,
        type: fields.type as 'expense' | 'income' | 'transfer',
        source: 'web-ai',
        raw_text: text,
        confidence: result.parsed.confidence,
        parsed_data: result.parsed as unknown as Record<string, unknown>,
      });
      toast.success('Transaction created from AI');
      resetState();
    } catch {
      toast.error('Failed to create transaction');
    }
  }

  function handleEditInForm(): void {
    const fields = buildTransactionFields();
    if (!fields || !result) return;

    // Open the TransactionForm pre-filled with parsed data as a partial Transaction
    const partial = {
      ...fields,
      notes: '',
      source: 'web-ai',
      raw_text: text,
      confidence: result.parsed.confidence,
      parsed_data: result.parsed as unknown as Record<string, unknown>,
    } as unknown as Transaction;

    openWith(partial);
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='border-border bg-card sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5' />
            AI Transaction
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div>
            <Textarea
              placeholder='Paste a bank message, SMS, or describe a transaction...'
              value={text}
              onChange={(e): void => setText(e.target.value)}
              rows={3}
              disabled={parsing}
            />
          </div>

          {!result && (
            <Button
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className='w-full cursor-pointer'>
              {parsing ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Parsing...
                </>
              ) : (
                'Parse with AI'
              )}
            </Button>
          )}

          {result && (
            <div className='space-y-3'>
              <div className='border-border space-y-2 rounded-lg border p-3'>
                <div className='grid grid-cols-2 gap-2 text-sm'>
                  <div>
                    <span className='text-muted-foreground text-xs'>Amount</span>
                    <p className='font-semibold'>${result.parsed.amount.toLocaleString('es-CO')}</p>
                  </div>
                  <div>
                    <span className='text-muted-foreground text-xs'>Confidence</span>
                    <p className='font-semibold'>{result.parsed.confidence}%</p>
                  </div>
                  <div className='col-span-2'>
                    <span className='text-muted-foreground text-xs'>Description</span>
                    <p className='font-medium'>{result.parsed.description}</p>
                  </div>
                  <div>
                    <span className='text-muted-foreground text-xs'>Category</span>
                    <p>{result.parsed.category}</p>
                  </div>
                  {result.parsed.bank && (
                    <div>
                      <span className='text-muted-foreground text-xs'>Bank</span>
                      <p>{result.parsed.bank}</p>
                    </div>
                  )}
                  {result.parsed.original_date && (
                    <div>
                      <span className='text-muted-foreground text-xs'>Date</span>
                      <p>{result.parsed.original_date}</p>
                    </div>
                  )}
                  {result.parsed.original_time && (
                    <div>
                      <span className='text-muted-foreground text-xs'>Time</span>
                      <p>{result.parsed.original_time}</p>
                    </div>
                  )}
                </div>
                {!result.resolved.account_id && (
                  <p className='text-destructive text-xs'>
                    No matching account found. Use &quot;Edit &amp; Create&quot; to select one.
                  </p>
                )}
              </div>

              <div className='flex flex-col gap-2'>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    className='flex-1 cursor-pointer'
                    onClick={(): void => setResult(null)}>
                    Re-parse
                  </Button>
                  <Button
                    variant='outline'
                    className='flex-1 cursor-pointer'
                    onClick={handleEditInForm}>
                    <Pencil className='mr-1.5 h-4 w-4' />
                    Edit & Create
                  </Button>
                </div>
                <div className='flex gap-2'>
                  <Button
                    className='flex-1 cursor-pointer'
                    disabled={createMutation.isPending || !result.resolved.account_id}
                    onClick={handleQuickCreate}>
                    {createMutation.isPending ? 'Creating...' : 'Quick Create'}
                  </Button>
                  <Button
                    variant='secondary'
                    className='cursor-pointer'
                    disabled={createMutation.isPending || !result.resolved.account_id}
                    onClick={handleQuickCreateAndAnother}>
                    Create & Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
