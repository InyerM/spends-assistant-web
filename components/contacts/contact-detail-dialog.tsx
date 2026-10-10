'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader } from '@/components/shared/loader';
import { useContactDetail, renameContact } from '@/lib/api/queries/contacts.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import type { Contact } from '@/types/contacts';

export function ContactDetailDialog({
  contact,
  onClose,
}: {
  contact: Contact;
  onClose: () => void;
}): React.ReactElement {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const cache = useQueryClient();
  const { data, isLoading, isError } = useContactDetail(contact.id);
  const [name, setName] = useState(contact.name);
  const [saving, setSaving] = useState(false);
  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await renameContact(contact.id, name.trim());
      await cache.invalidateQueries({ queryKey: ['contacts'] });
      await cache.invalidateQueries({ queryKey: ['contact-detail'] });
      toast.success(t('saved'));
    } catch {
      toast.error(t('failed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <DialogContent className='max-h-[85dvh] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-2xl [&>*]:min-w-0'>
        <DialogHeader>
          <DialogTitle className='pr-8 wrap-anywhere'>
            {data?.contact.custom_name ?? data?.contact.display_name ?? contact.name}
          </DialogTitle>
        </DialogHeader>
        <div className='space-y-2'>
          <Label htmlFor='contact-name'>{t('name')}</Label>
          <div className='flex min-w-0 flex-col gap-2 sm:flex-row'>
            <Input
              className='min-w-0 flex-1'
              id='contact-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
            />
            <Button
              className='min-h-11 shrink-0'
              disabled={saving || !name.trim()}
              onClick={() => void save()}>
              {t('save')}
            </Button>
          </div>
          <p className='text-muted-foreground text-sm wrap-anywhere'>
            {t(`kind.${contact.identity_kind}`)} · {contact.identity_value}
          </p>
        </div>
        {isLoading ? (
          <Loader />
        ) : isError ? (
          <p role='alert'>{t('failed')}</p>
        ) : data ? (
          <>
            <p className='text-muted-foreground text-sm wrap-anywhere'>
              {t('movements', { count: data.movement_count })}
            </p>
            <div className='grid gap-3 sm:grid-cols-2'>
              {data.totals.map((total) => (
                <div
                  key={total.currency}
                  className='bg-muted/30 border-border rounded-xl border p-4'>
                  <p className='font-medium'>{total.currency}</p>
                  <p className='text-muted-foreground mt-2 text-sm'>
                    {t('sent')}: {formatCurrency(total.expenses ?? 0, total.currency, locale)}
                  </p>
                  <p className='text-muted-foreground text-sm wrap-anywhere'>
                    {t('received')}: {formatCurrency(total.income ?? 0, total.currency, locale)}
                  </p>
                </div>
              ))}
            </div>
            <h3 className='font-medium'>{t('categoryHistory')}</h3>
            <div className='space-y-3'>
              {data.categories.map((category) => (
                <div key={category.category_id ?? 'none'} className='space-y-2'>
                  <div className='flex min-w-0 flex-wrap justify-between gap-2 text-sm'>
                    <span className='min-w-0 wrap-anywhere'>
                      {category.translations?.[locale] ?? category.name ?? t('uncategorized')}
                    </span>
                    <span>{t('movements', { count: category.count })}</span>
                  </div>
                  <Progress
                    aria-label={
                      category.translations?.[locale] ?? category.name ?? t('uncategorized')
                    }
                    value={data.movement_count ? (category.count / data.movement_count) * 100 : 0}
                  />
                </div>
              ))}
            </div>
            <h3 className='font-medium'>{t('recent')}</h3>
            <div className='divide-border divide-y'>
              {data.transactions.map((transaction) => (
                <Link
                  href={`/transactions/${transaction.id}`}
                  key={transaction.id}
                  className='hover:bg-muted/40 focus-visible:ring-ring flex items-center justify-between gap-4 rounded-lg px-2 py-3 focus-visible:ring-2'>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm'>{transaction.description}</p>
                    <p className='text-muted-foreground text-xs'>
                      {new Date(`${transaction.date}T12:00:00`).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <span className='shrink-0 text-sm tabular-nums'>
                    {formatCurrency(transaction.amount, transaction.currency, locale)}
                  </span>
                </Link>
              ))}
            </div>
            {data.movement_count > 100 ? (
              <p className='text-muted-foreground text-xs'>{t('latestOnly')}</p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
