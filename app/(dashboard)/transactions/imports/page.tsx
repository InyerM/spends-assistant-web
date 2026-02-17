'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, ArrowLeft, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImportRecord {
  id: string;
  file_name: string;
  row_count: number;
  imported_count: number;
  status: string;
  created_at: string;
}

interface ImportsResult {
  data: ImportRecord[];
  count: number;
}

const PAGE_SIZE = 20;

async function fetchImports(page: number): Promise<ImportsResult> {
  const res = await fetch(`/api/transactions/imports?page=${page}&limit=${PAGE_SIZE}`);
  if (!res.ok) throw new Error('Failed to fetch imports');
  return res.json() as Promise<ImportsResult>;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  pending: 'secondary',
  failed: 'destructive',
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

export default function ImportsPage(): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data: result, isLoading } = useQuery({
    queryKey: ['imports', page],
    queryFn: () => fetchImports(page),
  });

  const imports = result?.data ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleView = (importId: string): void => {
    router.push(`/transactions?import_id=${importId}`);
  };

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='flex items-center gap-3'>
        <Button
          variant='ghost'
          size='icon'
          className='cursor-pointer'
          onClick={(): void => router.back()}>
          <ArrowLeft className='h-5 w-5' />
        </Button>
        <h2 className='text-foreground text-xl font-bold sm:text-2xl'>{t('importHistory')}</h2>
      </div>

      {isLoading ? (
        <div className='space-y-3'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-12 w-full' />
          ))}
        </div>
      ) : imports.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-12'>
          <FileText className='text-muted-foreground mb-4 h-12 w-12' />
          <p className='text-muted-foreground'>{t('noImports')}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className='border-border hidden overflow-auto rounded-lg border md:block'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fieldDescription')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead className='text-right'>{t('rows')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead className='w-10' />
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
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className='text-right text-sm'>
                      {t('showingRows', {
                        imported: row.imported_count,
                        total: row.row_count,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[row.status] ?? 'outline'}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='cursor-pointer'
                        onClick={(): void => handleView(row.id)}
                        title={t('viewTransactions')}>
                        <Eye className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card view */}
          <div className='space-y-3 md:hidden'>
            {imports.map((row) => (
              <div key={row.id} className='border-border bg-card rounded-lg border p-4'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex min-w-0 items-center gap-2'>
                    <FileText className='text-muted-foreground h-4 w-4 shrink-0' />
                    <span className='truncate text-sm font-medium'>{row.file_name}</span>
                  </div>
                  <Badge variant={statusBadgeVariant[row.status] ?? 'outline'} className='shrink-0'>
                    {row.status}
                  </Badge>
                </div>
                <div className='text-muted-foreground mt-2 flex items-center justify-between text-xs'>
                  <span>{formatDate(row.created_at)}</span>
                  <span>
                    {t('showingRows', {
                      imported: row.imported_count,
                      total: row.row_count,
                    })}
                  </span>
                </div>
                <div className='mt-3'>
                  <Button
                    variant='outline'
                    size='sm'
                    className='w-full cursor-pointer'
                    onClick={(): void => handleView(row.id)}>
                    <Eye className='mr-1.5 h-3.5 w-3.5' />
                    {t('viewTransactions')}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between'>
              <Button
                variant='outline'
                size='sm'
                className='cursor-pointer'
                disabled={page <= 1}
                onClick={(): void => setPage((p) => p - 1)}>
                <ChevronLeft className='mr-1 h-4 w-4' />
                {t('previous')}
              </Button>
              <span className='text-muted-foreground text-sm'>
                {t('page', { page })} / {totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                className='cursor-pointer'
                disabled={page >= totalPages}
                onClick={(): void => setPage((p) => p + 1)}>
                {tCommon('next')}
                <ChevronRight className='ml-1 h-4 w-4' />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
