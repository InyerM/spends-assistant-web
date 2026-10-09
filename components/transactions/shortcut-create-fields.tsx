'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AiFieldStatus } from '@/components/shared/ai-field-status';
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
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import type { Locale } from '@/i18n/config';

export interface ShortcutCreateDraft extends ForwardedEmailDraft {
  accountId: string;
  categoryId: string;
  destinationAccountId?: string;
}

export function ShortcutCreateFields({
  draft,
  accounts,
  categories,
  onChange,
  analysisStates = {},
}: {
  analysisStates?: Partial<
    Record<keyof ShortcutCreateDraft, 'analyzing' | 'suggested' | 'automation' | 'history'>
  >;
  draft: ShortcutCreateDraft;
  accounts: Account[];
  categories: Category[];
  onChange: (patch: Partial<ShortcutCreateDraft>) => void;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const locale = useLocale() as Locale;
  const transactionT = useTranslations('transactions');
  const commonT = useTranslations('common');
  const fieldClass = (key: keyof ShortcutCreateDraft): string =>
    analysisStates[key] ? 'ai-field space-y-1' : 'space-y-1';
  const fieldStatus = (key: keyof ShortcutCreateDraft): React.ReactNode =>
    analysisStates[key] ? <AiFieldStatus state={analysisStates[key]} /> : null;
  const activeAccounts = accounts.filter(
    (account) => account.is_active && !account.deleted_at && account.currency === 'COP',
  );
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <div className={fieldClass('accountId')} data-ai-state={analysisStates['accountId']}>
        <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-1'>
          <label>{t('createAccount')}</label>
          {fieldStatus('accountId')}
        </div>
        <SearchableSelect
          value={draft.accountId}
          onValueChange={(accountId) => onChange({ accountId, destinationAccountId: '' })}
          ariaLabel={t('createAccount')}
          placeholder={t('chooseAccount')}
          searchPlaceholder={transactionT('searchAccounts')}
          items={buildAccountItems(activeAccounts)}
        />
      </div>
      <div className={fieldClass('type')} data-ai-state={analysisStates['type']}>
        <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-1'>
          <label>{t('createType')}</label>
          {fieldStatus('type')}
        </div>
        <Select
          value={draft.type}
          onValueChange={(type) =>
            onChange({
              type: type as ShortcutCreateDraft['type'],
              categoryId: '',
              destinationAccountId: '',
            })
          }>
          <SelectTrigger className='w-full' aria-label={t('createType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='expense'>{t('expense')}</SelectItem>
            <SelectItem value='income'>{t('income')}</SelectItem>
            <SelectItem value='transfer'>{transactionT('transfer')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {draft.type === 'transfer' ? (
        <div className='space-y-1'>
          <label>{transactionT('transferTo')}</label>
          <SearchableSelect
            value={draft.destinationAccountId ?? ''}
            onValueChange={(destinationAccountId) => onChange({ destinationAccountId })}
            ariaLabel={transactionT('transferTo')}
            placeholder={transactionT('selectDestAccount')}
            searchPlaceholder={transactionT('searchAccounts')}
            items={buildAccountItems(
              activeAccounts.filter((account) => account.id !== draft.accountId),
            )}
          />
        </div>
      ) : (
        <div className={fieldClass('categoryId')} data-ai-state={analysisStates['categoryId']}>
          <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-1'>
            <label>{t('createCategory')}</label>
            {fieldStatus('categoryId')}
          </div>
          <SearchableSelect
            value={draft.categoryId}
            onValueChange={(categoryId) => onChange({ categoryId })}
            ariaLabel={t('createCategory')}
            placeholder={t('chooseCategory')}
            searchPlaceholder={t('searchCategories')}
            items={buildCategoryItems(
              categories.filter((category) => category.is_active),
              draft.type,
              { locale, allPrefix: (name) => commonT('allOf', { name }) },
            )}
            collapsibleGroups
          />
        </div>
      )}
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
      <fieldset className={fieldClass('eventTime')} data-ai-state={analysisStates.eventTime}>
        <legend>{t('createEventTime')}</legend>
        {fieldStatus('eventTime')}
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
      <label
        className={`${fieldClass('description')} sm:col-span-2`}
        data-ai-state={analysisStates.description}>
        <span className='flex flex-wrap items-center justify-between gap-2'>
          {t('createDescription')}
          {fieldStatus('description')}
        </span>
        <Input
          type='text'
          aria-label={t('createDescription')}
          maxLength={500}
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>
      <label
        className={`${fieldClass('notes')} sm:col-span-2`}
        data-ai-state={analysisStates.notes}>
        <span className='flex flex-wrap items-center justify-between gap-2'>
          {t('createNotes')}
          {fieldStatus('notes')}
        </span>
        <Textarea
          aria-label={t('createNotes')}
          maxLength={2000}
          value={draft.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </label>
    </div>
  );
}
