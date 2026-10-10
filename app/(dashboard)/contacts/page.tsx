'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Store, ArrowRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/shared/search-input';
import { Loader, InlineLoader } from '@/components/shared/loader';
import { useContacts, scanContacts } from '@/lib/api/queries/contacts.queries';
import { ContactDetailDialog } from '@/components/contacts/contact-detail-dialog';
import type { Contact } from '@/types/contacts';

export default function ContactsPage(): React.ReactElement {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { data, isLoading, isError } = useContacts(search, page);
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
    <div className='space-y-6'>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-muted-foreground mt-2 max-w-2xl text-sm'>{t('subtitle')}</p>
        </div>
        <Button variant='outline' disabled={scanning} onClick={() => void scan()}>
          {scanning ? <InlineLoader /> : <RefreshCw className='size-4' />}
          {scanning ? t('scanning', { count: progress }) : t('scan')}
        </Button>
      </header>
      <SearchInput
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        placeholder={t('search')}
        clearLabel={t('clear')}
      />
      {data ? (
        <p className='text-muted-foreground text-sm' role='status'>
          {t('coverage', { scanned: data.scan.scanned, total: data.scan.total })}
          {data.scan.unresolved > 0 ? ` · ${t('unresolved', { count: data.scan.unresolved })}` : ''}
        </p>
      ) : null}
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <p role='alert' className='text-destructive'>
          {t('failed')}
        </p>
      ) : data?.items.length ? (
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {data.items.map((contact) => (
            <Card key={contact.id} className='overflow-hidden'>
              <CardContent className='p-0'>
                <button
                  type='button'
                  onClick={() => setSelected(contact)}
                  className='hover:bg-muted/30 focus-visible:ring-ring w-full space-y-4 p-5 text-left transition-colors focus-visible:ring-2'>
                  <div className='flex items-center gap-3'>
                    <span className='bg-muted rounded-xl p-3'>
                      {contact.identity_kind === 'merchant' ? (
                        <Store className='size-5' />
                      ) : (
                        <Users className='size-5' />
                      )}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <h2 className='truncate font-medium'>{contact.name}</h2>
                      <p className='text-muted-foreground text-xs'>
                        {t(`kind.${contact.identity_kind}`)}
                        {contact.identity_kind !== 'merchant'
                          ? ` · •${contact.identity_value.slice(-4)}`
                          : ''}
                      </p>
                    </div>
                    <ArrowRight className='text-muted-foreground size-4' />
                  </div>
                  <div className='flex justify-between gap-3 text-sm'>
                    <span>{t('movements', { count: contact.movement_count })}</span>
                    <span className='text-muted-foreground'>
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
