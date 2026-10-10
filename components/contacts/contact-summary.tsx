'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useContactSummary } from '@/lib/api/queries/contacts.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import type { Contact } from '@/types/contacts';
export function ContactSummary({
  onSelect,
}: {
  onSelect: (contact: Contact) => void;
}): React.ReactElement | null {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const { data } = useContactSummary();
  if (!data?.items.length) return null;
  const leader = data.items[0];
  const max = leader.movement_count || 1;
  const spending = data.spending;
  return (
    <section aria-label={t('summaryTitle')} className='grid items-start gap-3 md:grid-cols-3'>
      <div className='border-border bg-card min-w-0 rounded-xl border p-4'>
        <h2 className='text-sm font-medium'>{t('topSpending')}</h2>
        {['COP', 'USD'].map((currency) => {
          const contact = spending.find((item) => item.currency === currency);
          return contact ? (
            <button
              key={currency}
              type='button'
              onClick={() => onSelect(contact)}
              className='hover:bg-muted/40 focus-visible:ring-ring mt-2 w-full min-w-0 rounded-lg p-2 text-left focus-visible:ring-2'>
              <span className='text-brand-secondary block text-lg font-semibold tabular-nums'>
                {formatCurrency(contact.amount, currency, locale)}
              </span>
              <span className='block truncate text-sm'>
                {contact.custom_name ?? contact.display_name}
              </span>
              <span className='text-muted-foreground text-xs'>
                {currency} · {t('fullHistory')}
              </span>
            </button>
          ) : null;
        })}
        {!spending.length && (
          <p className='text-muted-foreground mt-3 text-sm'>{t('noSpending')}</p>
        )}
      </div>
      <div className='border-border bg-card min-w-0 rounded-xl border p-4'>
        <h2 className='text-sm font-medium'>{t('topTransactions')}</h2>
        <button
          type='button'
          onClick={() => onSelect(leader)}
          className='hover:bg-muted/40 focus-visible:ring-ring mt-2 w-full min-w-0 rounded-lg p-2 text-left focus-visible:ring-2'>
          <span className='text-brand block text-lg font-semibold tabular-nums'>
            {t('movements', { count: leader.movement_count })}
          </span>
          <span className='block truncate text-sm'>
            {leader.custom_name ?? leader.display_name}
          </span>
        </button>
        <p className='text-muted-foreground mt-3 flex flex-wrap gap-x-3 text-xs'>
          <span>
            <span className='tabular-nums'>{data.count}</span> {t('summaryContacts')}
          </span>
          <span>
            <span className='tabular-nums'>{data.scan.scanned}</span> {t('summaryReviewed')}
          </span>
        </p>
      </div>
      <div className='border-border bg-card min-w-0 rounded-xl border p-4'>
        <h2 className='text-sm font-medium'>{t('topContacts')}</h2>
        <div className='mt-2 space-y-1'>
          {data.items.map((contact) => (
            <button
              key={contact.id}
              type='button'
              onClick={() => onSelect(contact)}
              className='hover:bg-muted/40 focus-visible:ring-ring w-full min-w-0 space-y-1 rounded-md p-1.5 text-left focus-visible:ring-2'>
              <span className='flex gap-2 text-xs'>
                <span className='min-w-0 flex-1 truncate'>
                  {contact.custom_name ??
                    (contact.identity_kind === 'merchant'
                      ? contact.display_name
                      : `${t(`kind.${contact.identity_kind}`)} •${contact.identity_value.slice(-4)}`)}
                </span>
                <span className='shrink-0 tabular-nums'>
                  {t('movements', { count: contact.movement_count })}
                </span>
              </span>
              <span
                aria-hidden='true'
                className='bg-brand/10 block h-1 overflow-hidden rounded-full'>
                <span
                  className='bg-brand block h-full rounded-full'
                  style={{ width: `${(contact.movement_count / max) * 100}%` }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
