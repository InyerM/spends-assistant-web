'use client';

import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimePicker } from '@/components/ui/time-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/shared/searchable-select';
import type { Account, Category } from '@/types';
import type { ForwardedEmailDraft } from '@/lib/shortcut-inbox/create-draft';

export interface ShortcutCreateDraft extends ForwardedEmailDraft {
  accountId: string;
  categoryId: string;
}

export function ShortcutCreateFields({
  draft,
  accounts,
  categories,
  onChange,
}: {
  draft: ShortcutCreateDraft;
  accounts: Account[];
  categories: Category[];
  onChange: (patch: Partial<ShortcutCreateDraft>) => void;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <div className='space-y-1'>
        <label>{t('createAccount')}</label>
        <Select
          value={draft.accountId}
          onValueChange={(accountId) => {
            if (accountId) onChange({ accountId });
          }}>
          <SelectTrigger className='w-full' aria-label={t('createAccount')}>
            <SelectValue placeholder={t('chooseAccount')} />
          </SelectTrigger>
          <SelectContent>
            {accounts
              .filter((account) => account.is_active && !account.deleted_at)
              .map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                  {account.last_four ? ` · ${account.last_four}` : ''}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-1'>
        <label>{t('createType')}</label>
        <Select
          value={draft.type}
          onValueChange={(type) =>
            onChange({ type: type as ShortcutCreateDraft['type'], categoryId: '' })
          }>
          <SelectTrigger className='w-full' aria-label={t('createType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='expense'>{t('expense')}</SelectItem>
            <SelectItem value='income'>{t('income')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-1'>
        <label>{t('createCategory')}</label>
        <SearchableSelect
          value={draft.categoryId}
          onValueChange={(categoryId) => onChange({ categoryId })}
          ariaLabel={t('createCategory')}
          placeholder={t('chooseCategory')}
          searchPlaceholder={t('searchCategories')}
          items={categories
            .filter((category) => category.type === draft.type && category.is_active)
            .map((category) => ({ value: category.id, label: category.name }))}
        />
      </div>
      <label className='space-y-1'>
        {t('createAmount')}
        <Input
          type='text'
          inputMode='decimal'
          pattern='(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?'
          value={draft.amount}
          onChange={(event) => onChange({ amount: event.target.value })}
        />
      </label>
      <div className='space-y-1'>
        <label>{t('createDate')}</label>
        <DatePicker
          value={draft.date}
          onChange={(date) => onChange({ date, eventTimeConfirmed: false })}
          ariaLabel={t('createDate')}
        />
      </div>
      <fieldset className='space-y-1'>
        <legend>{t('createEventTime')}</legend>
        <TimePicker
          value={draft.eventTime}
          onChange={(eventTime) => onChange({ eventTime, eventTimeConfirmed: false })}
        />
      </fieldset>
      {draft.eventTime && (
        <label className='flex items-center gap-2 sm:col-span-2'>
          <Checkbox
            checked={draft.eventTimeConfirmed}
            onCheckedChange={(checked) => onChange({ eventTimeConfirmed: checked === true })}
          />
          {t('confirmEventTime')}
        </label>
      )}
      <label className='space-y-1 sm:col-span-2'>
        {t('createDescription')}
        <Input
          type='text'
          maxLength={500}
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>
      <label className='space-y-1 sm:col-span-2'>
        {t('createNotes')}
        <Textarea
          maxLength={2000}
          value={draft.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </label>
    </div>
  );
}
