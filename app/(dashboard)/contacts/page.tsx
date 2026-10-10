'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Store, ArrowRight, RefreshCw, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/shared/search-input';
import { Loader, InlineLoader } from '@/components/shared/loader';
import { useContacts, scanContacts } from '@/lib/api/queries/contacts.queries';
import { ContactSummary } from '@/components/contacts/contact-summary';
import { ContactDetailDialog } from '@/components/contacts/contact-detail-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Contact, ContactSort } from '@/types/contacts';

export default function ContactsPage(): React.ReactElement {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ContactSort>('recent');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { data, isLoading, isError } = useContacts(search, page, sort);
  const scan = async (): Promise<void> => {
    setScanning(true);
    setProgress(0);
    try {
      await scanContacts(setProgress);
      await cache.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(t('scanDone'));
    } catch {
      toast.error(t('failed'));
    } finally {
      setScanning(false);
    }
  };
  return (
    <div className='mx-auto w-full max-w-6xl space-y-6 px-4 py-7 sm:px-6'>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div className='max-w-2xl space-y-2'>
          <div className='text-brand flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase'>
            <Users className='size-4' aria-hidden='true' />
            {t('eyebrow')}
          </div>
          <h1 className='text-3xl font-semibold tracking-tight'>{t('title')}</h1>
          <p className='text-muted-foreground text-sm leading-6'>{t('subtitle')}</p>
        </div>
        <Button
          variant='outline'
          className='min-h-11 w-full gap-2 sm:w-auto'
          disabled={scanning}
          onClick={() => void scan()}>
          {scanning ? <InlineLoader /> : <RefreshCw className='size-4' aria-hidden='true' />}
          {scanning ? t('scanning', { count: progress }) : t('scan')}
        </Button>
      </header>
      <ContactSummary onSelect={setSelected} />
      <section
        aria-label={t('directory')}
        className='border-border bg-card space-y-3 rounded-xl border p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <div className='min-w-0 flex-1'>
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder={t('search')}
              clearLabel={t('clear')}
            />
          </div>
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value as ContactSort);
              setPage(1);
            }}>
            <SelectTrigger className='w-full shrink-0 sm:w-56' aria-label={t('sortLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='recent'>{t('sortRecent')}</SelectItem>
              <SelectItem value='most_transactions'>{t('sortMost')}</SelectItem>
              <SelectItem value='fewest_transactions'>{t('sortFewest')}</SelectItem>
            </SelectContent>
          </Select>
          {data ? (
            <p className='text-muted-foreground shrink-0 text-sm' role='status'>
              {t('results', { count: data.count })}
            </p>
          ) : null}
        </div>
        {data ? (
          <details className='group border-border border-t pt-3 text-sm'>
            <summary className='text-muted-foreground focus-visible:ring-ring flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 rounded-md focus-visible:ring-2 [&::-webkit-details-marker]:hidden'>
              <span>{t('coverage', { scanned: data.scan.scanned, total: data.scan.total })}</span>
              <ChevronDown
                className='size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none'
                aria-hidden='true'
              />
            </summary>
            <p className='text-muted-foreground mt-2 leading-6'>
              {t('scanHint')}
              {data.scan.unresolved > 0
                ? ` ${t('unresolved', { count: data.scan.unresolved })}`
                : ''}
            </p>
          </details>
        ) : null}
      </section>
      {isLoading ? (
        <div className='flex justify-center py-16'>
          <Loader />
        </div>
      ) : isError ? (
        <p role='alert' className='text-destructive'>
          {t('failed')}
        </p>
      ) : data?.items.length ? (
        <div className='grid gap-3 md:grid-cols-2'>
          {data.items.map((contact) => (
            <Card key={contact.id} className='overflow-hidden py-0'>
              <CardContent className='p-0'>
                <button
                  type='button'
                  onClick={() => setSelected(contact)}
                  className='group hover:bg-muted/30 focus-visible:ring-ring min-h-11 w-full cursor-pointer space-y-3 p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-inset motion-reduce:transition-none'>
                  <div className='flex items-center gap-3'>
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${contact.identity_kind === 'merchant' ? 'bg-brand-secondary/10 text-brand-secondary' : 'bg-primary/10 text-primary'}`}>
                      {contact.identity_kind === 'merchant' ? (
                        <Store className='size-5' aria-hidden='true' />
                      ) : (
                        <Users className='size-5' aria-hidden='true' />
                      )}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <h2 className='text-sm leading-5 font-medium wrap-anywhere'>
                        {contact.custom_name ??
                          (contact.identity_kind === 'merchant'
                            ? contact.display_name
                            : `${t(`kind.${contact.identity_kind}`)} •${contact.identity_value.slice(-4)}`)}
                      </h2>
                      <p className='text-muted-foreground text-xs'>
                        {t(`kind.${contact.identity_kind}`)}
                        {contact.custom_name && contact.identity_kind !== 'merchant'
                          ? ` · •${contact.identity_value.slice(-4)}`
                          : ''}
                      </p>
                    </div>
                    <ArrowRight
                      className='text-muted-foreground group-hover:text-foreground size-4 shrink-0'
                      aria-hidden='true'
                    />
                  </div>
                  <div className='border-border/60 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs'>
                    <span className='bg-muted text-foreground rounded-md px-2 py-1 tabular-nums'>
                      {t('movements', { count: contact.movement_count })}
                    </span>
                    <span className='text-muted-foreground'>
                      {contact.last_activity ? `${t('lastActivity')} · ` : ''}
                      {contact.last_activity
                        ? new Date(`${contact.last_activity}T12:00:00`).toLocaleDateString(locale)
                        : ''}
                    </span>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className='py-10 text-center'>
            <Users className='text-muted-foreground mx-auto mb-3 size-8' />
            <h2 className='font-medium'>{t(search ? 'noMatches' : 'empty')}</h2>
            <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm'>
              {t(search ? 'searchHint' : 'emptyHint')}
            </p>
          </CardContent>
        </Card>
      )}
      {data && data.count > 50 ? (
        <div className='flex justify-end gap-2'>
          <Button
            variant='outline'
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}>
            {t('previous')}
          </Button>
          <Button
            variant='outline'
            disabled={page * 50 >= data.count}
            onClick={() => setPage((value) => value + 1)}>
            {t('next')}
          </Button>
        </div>
      ) : null}
      {selected ? (
        <ContactDetailDialog
          key={selected.id}
          contact={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
