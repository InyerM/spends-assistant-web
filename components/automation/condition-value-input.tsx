'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ConditionRow } from '@/lib/utils/automation-form';

interface ConditionValueInputProps {
  row: ConditionRow;
  onChange: (value: string) => void;
}

export function ConditionValueInput({
  row,
  onChange,
}: ConditionValueInputProps): React.ReactElement {
  const t = useTranslations('automation');
  const tTx = useTranslations('transactions');

  if (row.type === 'type') {
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
  if (row.type === 'amount_greater_than' || row.type === 'amount_less_than') {
    return (
      <Input
        type='number'
        placeholder='0'
        className='h-9 flex-1'
        value={row.value}
        onChange={(e): void => onChange(e.target.value)}
      />
    );
  }
  if (row.type === 'source') {
    return (
      <Input
        placeholder={t('sourcePlaceholder')}
        className='h-9 flex-1'
        value={row.value}
        onChange={(e): void => onChange(e.target.value)}
      />
    );
  }
  // raw_text_contains
  return (
    <Input
      placeholder={t('rawTextPlaceholder')}
      className='h-9 flex-1'
      value={row.value}
      onChange={(e): void => onChange(e.target.value)}
    />
  );
}
