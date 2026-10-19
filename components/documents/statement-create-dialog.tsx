'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { useCreateStatementTransaction } from '@/lib/api/mutations/statement.mutations';
import { useCategories } from '@/lib/api/queries/category.queries';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { DocumentAccountSelect } from './document-review-selects';
import { buildCategoryItems } from '@/lib/utils/select-items';
import { InlineLoader } from '@/components/shared/loader';
import type { StatementRow } from '@/lib/statement-reconciliation';
import type { Account } from '@/types';
export function StatementCreateDialog({
  documentId,
  row,
  accounts,
  account,
  disabled,
}: {
  documentId: string;
  row: StatementRow;
  accounts: Account[];
  account: string;
  disabled: boolean;
}): React.ReactElement {
  const t = useTranslations('statementReconciliation'),
    locale = useLocale();
  const [open, setOpen] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [description, setDescription] = useState(row.description ?? ''),
    [category, setCategory] = useState(''),
    [transfer, setTransfer] = useState(false),
    [other, setOther] = useState(''),
    [key] = useState(() => crypto.randomUUID());
  const categories = useCategories(),
    create = useCreateStatementTransaction(documentId);
  const own = accounts.find((a) => a.id === account);
  const amount = row.amount ?? 0;
  return (
    <>
      <Button size='sm' variant='outline' disabled={disabled} onClick={() => setOpen(true)}>
        <Plus className='size-4' />
        {t('createMissing')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!create.isPending) setOpen(value);
        }}>
        <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('createMissing')}</DialogTitle>
            <DialogDescription>{t('createHint')}</DialogDescription>
          </DialogHeader>
          <div className='bg-muted space-y-1 rounded-lg p-3 text-sm'>
            <p>{own?.name}</p>
            <p>{row.occurred_at_text}</p>
            <p className={amount > 0 ? 'text-success' : 'text-destructive'}>
              {new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: row.currency ?? 'COP',
              }).format(amount)}
            </p>
            <p className='text-muted-foreground text-xs'>{t('statementSource')}</p>
          </div>
          <label className='space-y-1 text-sm'>
            {t('description')}
            <Input
              value={description}
              disabled={create.isPending}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
            />
          </label>
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={transfer}
              disabled={create.isPending}
              onCheckedChange={(value) => {
                setTransfer(value === true);
                setCategory('');
              }}
            />
            {t('ownTransfer')}
          </label>
          {transfer ? (
            <DocumentAccountSelect
              value={other}
              onChange={setOther}
              accounts={accounts.filter(
                (a) =>
                  a.id !== account && a.is_active && !a.deleted_at && a.currency === row.currency,
              )}
              label={t('otherAccount')}
              disabled={create.isPending}
            />
          ) : (
            <SearchableSelect
              ariaLabel={t('category')}
              value={category}
              onValueChange={setCategory}
              placeholder={t('category')}
              disabled={create.isPending}
              items={buildCategoryItems(categories.data ?? [], amount > 0 ? 'income' : 'expense', {
                locale: locale as 'en' | 'es' | 'pt',
                allPrefix: (name) => name,
              })}
            />
          )}
          <label className='flex items-start gap-2 text-sm'>
            <Checkbox
              checked={confirmed}
              disabled={create.isPending}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            {t('createConfirmation')}
          </label>
          {create.error && (
            <p role='alert' className='text-destructive text-sm'>
              {t(
                create.error.message === 'POSSIBLE_DUPLICATE' ? 'createDuplicate' : 'createFailed',
              )}
            </p>
          )}
          <div className='flex justify-end gap-2'>
            <Button variant='ghost' disabled={create.isPending} onClick={() => setOpen(false)}>
              {t('cancelCreate')}
            </Button>
            <Button
              disabled={
                create.isPending || !confirmed || !description.trim() || (transfer && !other)
              }
              onClick={() =>
                create.mutate(
                  {
                    request_id: key,
                    observation_id: row.id,
                    category_id: transfer ? null : category || null,
                    description: description.trim(),
                    transfer_account_id: transfer ? other : null,
                  },
                  { onSuccess: () => setOpen(false) },
                )
              }>
              {create.isPending && <InlineLoader />}
              {t('createAndReconcile')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
