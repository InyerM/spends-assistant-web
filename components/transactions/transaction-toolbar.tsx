'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  CheckSquare,
  Download,
  FileImage,
  FileSearch,
  History,
  Inbox,
  MoreHorizontal,
  Plus,
  Upload,
} from 'lucide-react';
import { PeriodSelector } from '@/components/transactions/period-selector';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TransactionToolbarProps {
  dateFrom: string;
  dateTo: string;
  onPeriodChange: (dateFrom: string, dateTo: string) => void;
  onNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onSelect: () => void;
  exportDisabled: boolean;
}

export function TransactionToolbar({
  dateFrom,
  dateTo,
  onPeriodChange,
  onNew,
  onImport,
  onExport,
  onSelect,
  exportDisabled,
}: TransactionToolbarProps): React.ReactElement {
  const t = useTranslations('transactions');
  const common = useTranslations('common');

  return (
    <div className='flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
      <div className='min-w-0 space-y-3 self-start'>
        <h1 className='text-foreground text-3xl font-semibold tracking-tight sm:text-4xl'>
          {t('title')}
        </h1>
        <PeriodSelector dateFrom={dateFrom} dateTo={dateTo} onChange={onPeriodChange} />
      </div>
      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <Button variant='outline' size='sm' className='hidden sm:inline-flex' onClick={onImport}>
          <Upload aria-hidden='true' className='mr-1.5 h-4 w-4' />
          {common('import')}
        </Button>
        <Button variant='ai' size='sm' asChild>
          <Link href='/documents?from=transactions'>
            <FileImage aria-hidden='true' className='mr-1.5 h-4 w-4' />
            {t('uploadDocument')}
          </Link>
        </Button>
        <Button size='sm' onClick={onNew} aria-label={t('newTransaction')}>
          <Plus aria-hidden='true' className='mr-1.5 h-4 w-4' />
          <span className='hidden sm:inline'>{t('newTransaction')}</span>
          <span className='sm:hidden'>{common('new')}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' size='sm' aria-label={t('moreActions')}>
              <MoreHorizontal aria-hidden='true' className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={onSelect}>
              <CheckSquare aria-hidden='true' className='mr-2 h-4 w-4' />
              {common('select')}
            </DropdownMenuItem>
            <DropdownMenuItem className='sm:hidden' onClick={onImport}>
              <Upload aria-hidden='true' className='mr-2 h-4 w-4' />
              {common('import')}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={exportDisabled} onClick={onExport}>
              <Download aria-hidden='true' className='mr-2 h-4 w-4' />
              {common('export')}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/transactions/imports'>
                <History aria-hidden='true' className='mr-2 h-4 w-4' />
                {t('importHistory')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/transactions/shortcut-inbox'>
                <Inbox aria-hidden='true' className='mr-2 h-4 w-4' />
                {t('shortcutInbox')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href='/transactions/account-corrections'>
                <FileSearch aria-hidden='true' className='mr-2 h-4 w-4' />
                {t('accountCorrections')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
