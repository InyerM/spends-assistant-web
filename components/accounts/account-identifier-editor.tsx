'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AccountIdentifier } from '@/types/account';
import { defaultIdentifierKind } from '@/lib/accounts/identifiers';

interface Props {
  value: AccountIdentifier[];
  onChange: (value: AccountIdentifier[]) => void;
  accountType: string;
}

export function AccountIdentifierEditor({
  value,
  onChange,
  accountType,
}: Props): React.ReactElement {
  const t = useTranslations('accounts.identifiers');
  const [chosenKind, setChosenKind] = useState<AccountIdentifier['kind'] | null>(null);
  const kind = chosenKind ?? defaultIdentifierKind(accountType);
  const [suffix, setSuffix] = useState('');

  function add(): void {
    if (
      !/^\d{4}$/u.test(suffix) ||
      value.some((item) => item.last_four === suffix) ||
      value.length >= 12
    )
      return;
    onChange([
      ...value,
      { kind, last_four: suffix, is_active: true, is_primary: value.length === 0 },
    ]);
    setSuffix('');
  }

  function update(index: number, change: Partial<AccountIdentifier>): void {
    const next = value.map((item, at) => {
      if (change.is_primary === true && at !== index) return { ...item, is_primary: false };
      return at === index ? { ...item, ...change } : item;
    });
    onChange(next);
  }

  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium'>{t('heading')}</div>
      <p className='text-muted-foreground text-xs'>{t('help')}</p>
      {value.map((item, index) => (
        <div
          key={`${item.kind}-${item.last_four}`}
          className='border-border flex flex-wrap items-center gap-2 rounded-lg border p-2'>
          <span className='min-w-28 text-sm'>
            {t(item.kind)} · *{item.last_four}
          </span>
          <Button
            type='button'
            size='sm'
            variant={item.is_primary ? 'secondary' : 'outline'}
            disabled={!item.is_active || item.is_primary}
            onClick={() => update(index, { is_primary: true })}>
            {t('primary')}
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={item.is_primary}
            onClick={() => update(index, { is_active: !item.is_active })}>
            {item.is_active ? t('active') : t('retired')}
          </Button>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            disabled={item.is_primary}
            onClick={() => onChange(value.filter((_, at) => at !== index))}>
            {t('remove')}
          </Button>
        </div>
      ))}
      <div className='flex flex-wrap gap-2'>
        <Select
          value={kind}
          onValueChange={(next) => setChosenKind(next as AccountIdentifier['kind'])}>
          <SelectTrigger className='w-40' aria-label={t('kind')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['bank_account', 'debit_card', 'credit_card', 'other'] as const).map((item) => (
              <SelectItem key={item} value={item}>
                {t(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className='w-28'
          value={suffix}
          onChange={(event) => setSuffix(event.target.value.replace(/\D/gu, '').slice(0, 4))}
          maxLength={4}
          inputMode='numeric'
          placeholder='1234'
          aria-label={t('number')}
        />
        <Button
          type='button'
          variant='outline'
          disabled={
            !/^\d{4}$/u.test(suffix) ||
            value.some((item) => item.last_four === suffix) ||
            value.length >= 12
          }
          onClick={add}>
          {t('add')}
        </Button>
      </div>
    </div>
  );
}
