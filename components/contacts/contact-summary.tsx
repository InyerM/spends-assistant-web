'use client';
import { useTranslations } from 'next-intl';
import { useContactSummary } from '@/lib/api/queries/contacts.queries';
import type { Contact } from '@/types/contacts';
export function ContactSummary({
  onSelect,
}: {
  onSelect: (contact: Contact) => void;
}): React.ReactElement | null {
  const t = useTranslations('contacts');
  const { data } = useContactSummary();
  if (!data?.items.length) return null;
  const max = data.items[0]?.movement_count ?? 1;
  return (
    <section
      aria-label={t('summaryTitle')}
      className='border-border bg-card grid gap-6 rounded-xl border p-4 sm:p-5 lg:grid-cols-[1fr_2fr]'>
      <div className='space-y-3'>
        <h2 className='font-semibold'>{t('summaryTitle')}</h2>
        <p className='text-muted-foreground text-sm leading-6'>{t('summaryHint')}</p>
        <dl className='grid grid-cols-2 gap-4'>
          <div>
            <dt className='text-muted-foreground text-xs'>{t('summaryContacts')}</dt>
            <dd className='mt-1 text-2xl font-semibold tabular-nums'>{data.count}</dd>
          </div>
          <div>
            <dt className='text-muted-foreground text-xs'>{t('summaryReviewed')}</dt>
            <dd className='mt-1 text-2xl font-semibold tabular-nums'>{data.scan.scanned}</dd>
          </div>
        </dl>
      </div>
      <div className='min-w-0 space-y-2'>
        <h3 className='text-sm font-medium'>{t('topContacts')}</h3>
        {data.items.map((contact) => (
          <button
            type='button'
            key={contact.id}
            onClick={() => onSelect(contact)}
            className='hover:bg-muted/40 focus-visible:ring-ring w-full min-w-0 cursor-pointer space-y-2 rounded-lg p-2 text-left focus-visible:ring-2'>
            <span className='flex justify-between gap-3 text-sm'>
              <span className='min-w-0 wrap-anywhere'>
                {contact.custom_name ??
                  (contact.identity_kind === 'merchant'
                    ? contact.display_name
                    : `${t(`kind.${contact.identity_kind}`)} •${contact.identity_value.slice(-4)}`)}
              </span>
              <span className='shrink-0 tabular-nums'>
                {t('movements', { count: contact.movement_count })}
              </span>
            </span>
            <div aria-hidden='true' className='bg-primary/10 h-2 overflow-hidden rounded-full'>
              <div
                className='bg-primary h-full rounded-full'
                style={{ width: `${(contact.movement_count / max) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
