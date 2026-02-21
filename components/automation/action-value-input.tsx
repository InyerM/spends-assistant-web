'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import type { ActionRow } from '@/lib/utils/automation-form';
import type { Account, Category } from '@/types';

interface ActionValueInputProps {
  row: ActionRow;
  onChange: (value: string) => void;
  accounts: Account[] | undefined;
  categories: Category[] | undefined;
}

export function ActionValueInput({
  row,
  onChange,
  accounts,
  categories,
}: ActionValueInputProps): React.ReactElement {
  const t = useTranslations('automation');
  const tTx = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  if (row.type === 'set_type') {
    return (
      <Select value={row.value || undefined} onValueChange={onChange}>
        <SelectTrigger className='h-9 flex-1'>
          <SelectValue placeholder={tTx('selectType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='expense'>{tTx('expense')}</SelectItem>
          <SelectItem value='income'>{tTx('income')}</SelectItem>
          <SelectItem value='transfer'>{tTx('transfer')}</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (row.type === 'set_category') {
    return (
      <div className='flex-1'>
        <SearchableSelect
          value={row.value || undefined}
          onValueChange={onChange}
          placeholder={tTx('selectCategory')}
          searchPlaceholder={tTx('searchCategories')}
          items={buildCategoryItems(categories ?? [], undefined, {
            locale: locale as 'en' | 'es' | 'pt',
            allPrefix: (name: string): string => tCommon('allOf', { name }),
          })}
        />
      </div>
    );
  }
  if (row.type === 'set_account' || row.type === 'transfer_to_account') {
    return (
      <div className='flex-1'>
        <SearchableSelect
          value={row.value || undefined}
          onValueChange={onChange}
          placeholder={tTx('selectAccount')}
          searchPlaceholder={tTx('searchAccounts')}
          items={buildAccountItems(accounts ?? [])}
        />
      </div>
    );
  }
  if (row.type === 'auto_reconcile') {
    return (
      <div className='flex flex-1 items-center'>
        <Switch
          checked={row.value === 'true'}
          onCheckedChange={(checked): void => onChange(checked ? 'true' : 'false')}
        />
        <span className='text-muted-foreground ml-2 text-sm'>
          {row.value === 'true' ? tCommon('enabled') : tCommon('disabled')}
        </span>
      </div>
    );
  }
  // add_note
  return (
    <Input
      placeholder={t('notePlaceholder')}
      className='h-9 flex-1'
      value={row.value}
      onChange={(e): void => onChange(e.target.value)}
    />
  );
}
