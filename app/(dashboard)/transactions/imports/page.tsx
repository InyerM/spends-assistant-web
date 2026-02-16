'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText } from 'lucide-react';

interface ImportRecord {
  id: string;
  file_name: string;
  row_count: number;
  imported_count: number;
  status: string;
  created_at: string;
}

async function fetchImports(): Promise<ImportRecord[]> {
  const res = await fetch('/api/transactions/imports');
  if (!res.ok) throw new Error('Failed to fetch imports');
  return res.json() as Promise<ImportRecord[]>;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  pending: 'secondary',
  failed: 'destructive',
};

export default function ImportsPage(): React.ReactElement {
  const t = useTranslations('transactions');
  const { data: imports, isLoading } = useQuery({
    queryKey: ['imports'],
    queryFn: fetchImports,
  });

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='min-w-0'>
        <h2 className='text-foreground text-xl font-bold sm:text-2xl'>{t('importHistory')}</h2>
      </div>

      {isLoading ? (
        <div className='space-y-3'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-12 w-full' />
          ))}
        </div>
      ) : !imports || imports.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-12'>
          <FileText className='text-muted-foreground mb-4 h-12 w-12' />
          <p className='text-muted-foreground'>{t('noTransactions')}</p>
        </div>
      ) : (
        <div className='overflow-auto rounded border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fieldDescription')}</TableHead>
                <TableHead>{t('date')}</TableHead>
                <TableHead className='text-right'>{t('rows')}</TableHead>
                <TableHead className='text-right'>
                  {t('importedCount', { count: '' }).trim()}
                </TableHead>
                <TableHead>{t('type')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className='font-medium'>
                    <div className='flex items-center gap-2'>
                      <FileText className='text-muted-foreground h-4 w-4 shrink-0' />
                      <span className='truncate'>{row.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>
                    {new Date(row.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className='text-right'>{row.row_count}</TableCell>
                  <TableCell className='text-right'>{row.imported_count}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[row.status] ?? 'outline'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
