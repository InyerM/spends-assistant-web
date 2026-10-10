'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePurchaseLocations } from '@/lib/api/queries/locations.queries';
export default function LocationsPage(): React.ReactElement {
  const t = useTranslations('locations');
  const locale = useLocale();
  const [offset, setOffset] = useState(0);
  const { data, isPending, isError } = usePurchaseLocations(offset);
  const total = data?.[0]?.total_count ?? 0;
  return (
    <div className='mx-auto max-w-6xl space-y-6 p-4 sm:p-6'>
      <header>
        <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        <p className='text-muted-foreground mt-2 max-w-2xl'>{t('hint')}</p>
      </header>
      {isPending && <p role='status'>{t('loading')}</p>}
      {isError && <p role='alert'>{t('error')}</p>}
      {data?.length === 0 && (
        <div className='rounded-xl border border-dashed p-8'>
          <MapPin className='text-primary mb-3 size-6' />
          <p>{t('empty')}</p>
          <Link
            className='text-primary mt-3 block hover:underline'
            href='https://anotto.app/shortcuts/'>
            {t('setup')}
          </Link>
        </div>
      )}
      <div className='grid gap-4 sm:grid-cols-2'>
        {data?.map((location) => (
          <article
            key={location.transaction_id}
            className='border-border bg-card min-w-0 space-y-3 rounded-xl border p-5'>
            <h2 className='font-semibold break-words'>{location.description}</h2>
            <p>
              {new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: location.currency,
              }).format(location.amount)}{' '}
              · {location.date}
            </p>
            <p className='text-muted-foreground text-sm'>
              {t('captured')} ·{' '}
              {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(location.captured_at),
              )}
            </p>
            <p className='text-muted-foreground font-mono text-sm'>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </p>
            <div className='flex flex-wrap gap-3'>
              <Button asChild variant='outline'>
                <Link href={`/transactions/${location.transaction_id}`}>{t('transaction')}</Link>
              </Button>
              <Button asChild variant='outline'>
                <a
                  href={`https://maps.apple.com/?ll=${location.latitude},${location.longitude}`}
                  target='_blank'
                  rel='noopener noreferrer'>
                  {t('map')}
                </a>
              </Button>
            </div>
          </article>
        ))}
      </div>
      {(offset > 0 || total > 100) && (
        <div className='flex gap-3'>
          <Button
            variant='outline'
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 100))}>
            {t('previous')}
          </Button>
          <Button
            variant='outline'
            disabled={offset + 100 >= total}
            onClick={() => setOffset(offset + 100)}>
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
