'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ContactDetailDialog } from '@/components/contacts/contact-detail-dialog';
import type { Contact } from '@/types/contacts';
import { useTranslations } from 'next-intl';
import { useContactSummary } from '@/lib/api/queries/contacts.queries';
export function TopContacts(): React.ReactElement | null {
  const t = useTranslations('contacts');
  const [selected, setSelected] = useState<Contact | null>(null);
  const { data } = useContactSummary();
  if (!data?.items.length) return null;
  const max = data.items[0].movement_count || 1;
  return (
    <section className='border-border bg-card min-w-0 space-y-4 rounded-xl border p-5'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='font-semibold'>{t('topContacts')}</h2>
        <Link href='/contacts' className='text-brand text-sm hover:underline'>
          {t('viewAll')}
        </Link>
      </div>
      <p className='text-muted-foreground text-xs'>{t('fullHistory')}</p>
      <ol className='space-y-3'>
        {data.items.map((contact) => (
          <li key={contact.id}>
            <button
              type='button'
              onClick={() => setSelected(contact)}
              className='hover:bg-muted/40 focus-visible:ring-ring block w-full min-w-0 space-y-2 rounded-md p-1 text-left focus-visible:ring-2'>
              <span className='flex justify-between gap-3 text-sm'>
                <span className='truncate'>{contact.custom_name ?? contact.display_name}</span>
                <span className='shrink-0 tabular-nums'>{contact.movement_count}</span>
              </span>
              <span
                aria-hidden='true'
                className='bg-brand/10 block h-1.5 overflow-hidden rounded-full'>
                <span
                  className='bg-brand block h-full'
                  style={{ width: `${(contact.movement_count / max) * 100}%` }}
                />
              </span>
            </button>
          </li>
        ))}
      </ol>
      {selected && <ContactDetailDialog contact={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
