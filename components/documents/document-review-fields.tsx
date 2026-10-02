'use client';

import { useLocale, useTranslations } from 'next-intl';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Account, Category } from '@/types';
import type { ApprovalDraft } from '@/lib/document-review';
import { DocumentAccountSelect } from '@/components/documents/document-review-selects';

export interface DocumentReviewFieldsDraft extends ApprovalDraft {
  categoryId: string;
}

interface Props {
  draft: DocumentReviewFieldsDraft;
  accounts: Account[];
  categories: Category[];
  disabled: boolean;
  onChange: (patch: Partial<DocumentReviewFieldsDraft>) => void;
}

export function DocumentReviewFields({
  draft,
  accounts,
  categories,
  disabled,
  onChange,
}: Props): React.ReactElement {
  const t = useTranslations('documents');
  const locale = useLocale();
  const activeAccounts = accounts.filter(
    (account) => account.is_active && !account.deleted_at && account.currency === draft.currency,
  );
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <div className='space-y-1 text-sm'>
        <label>{t('transactionDate')}</label>
        <DatePicker
          value={draft.date}
          onChange={(date) => onChange({ date })}
          disabled={disabled}
          locale={locale === 'es' ? 'es' : 'en'}
          ariaLabel={t('transactionDate')}
        />
      </div>
      <label className='space-y-1 text-sm'>
        {t('transactionTime')}
        <Input
          type='time'
          aria-label={t('transactionTime')}
          value={draft.time}
          disabled={disabled}
          onChange={(event) => onChange({ time: event.target.value })}
        />
        <span className='text-muted-foreground block text-xs'>{t('timeOptional')}</span>
      </label>
      <label className='space-y-1 text-sm'>
        {t('transactionAmount')}
        <Input
          type='number'
          aria-label={t('transactionAmount')}
          min='0.01'
          step='0.01'
          value={draft.amount}
          disabled={disabled}
          onChange={(event) => onChange({ amount: event.target.value })}
        />
      </label>
      <div className='space-y-1 text-sm'>
        <label>{t('transactionCurrency')}</label>
        <Select
          value={draft.currency}
          onValueChange={(currency) => onChange({ currency, accountId: '' })}
          disabled={disabled}>
          <SelectTrigger className='w-full' aria-label={t('transactionCurrency')}>
            <SelectValue placeholder={t('selectCurrency')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='COP'>COP</SelectItem>
            <SelectItem value='USD'>USD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-1 text-sm'>
        <label>{t('transactionType')}</label>
        <Select
          value={draft.type}
          onValueChange={(type) =>
            onChange({
              type: type as ApprovalDraft['type'],
              categoryId: '',
              destinationAccountId: '',
            })
          }
          disabled={disabled}>
          <SelectTrigger className='w-full' aria-label={t('transactionType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='expense'>{t('expense')}</SelectItem>
            <SelectItem value='income'>{t('income')}</SelectItem>
            <SelectItem value='transfer'>{t('transfer')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className='space-y-1 text-sm'>
        <label>{t('transactionAccount')}</label>
        <DocumentAccountSelect
          value={draft.accountId}
          onChange={(accountId) => onChange({ accountId })}
          accounts={activeAccounts}
          disabled={disabled}
          label={t('transactionAccount')}
        />
      </div>
      {draft.type === 'transfer' && (
        <div className='space-y-1 text-sm'>
          <label>{t('destinationAccount')}</label>
          <DocumentAccountSelect
            value={draft.destinationAccountId}
            onChange={(destinationAccountId) => onChange({ destinationAccountId })}
            accounts={activeAccounts.filter((account) => account.id !== draft.accountId)}
            disabled={disabled}
            label={t('destinationAccount')}
          />
        </div>
      )}
      {draft.type !== 'transfer' && (
        <div className='space-y-1 text-sm'>
          <label>{t('transactionCategory')}</label>
          <Select
            value={draft.categoryId || '__none__'}
            onValueChange={(value) => onChange({ categoryId: value === '__none__' ? '' : value })}
            disabled={disabled}>
            <SelectTrigger className='w-full' aria-label={t('transactionCategory')}>
              <SelectValue placeholder={t('selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__none__'>{t('selectCategory')}</SelectItem>
              {categories
                .filter((category) => category.type === draft.type && category.is_active)
                .map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <label className='space-y-1 text-sm sm:col-span-2'>
        {t('transactionDescription')}
        <Input
          aria-label={t('transactionDescription')}
          value={draft.description}
          disabled={disabled}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </label>
    </div>
  );
}
