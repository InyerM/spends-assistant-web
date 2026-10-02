'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Account } from '@/types';

export function DocumentAccountSelect({
  value,
  accounts,
  disabled,
  label,
  onChange,
}: {
  value: string;
  accounts: Account[];
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  const t = useTranslations('documents');
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className='w-full' aria-label={label}>
        <SelectValue placeholder={t('selectAccount')} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
            {account.last_four ? ` · ${account.last_four}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DocumentRejectReasonSelect({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}): React.ReactElement {
  const t = useTranslations('documents');
  const reasons = [
    'already_recorded',
    'duplicate_capture',
    'not_a_transaction',
    'unreadable',
    'wrong_account',
    'other',
  ] as const;
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className='w-full sm:w-64' aria-label={t('rejectReason')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {reasons.map((reason) => (
          <SelectItem key={reason} value={reason}>
            {t(`reason.${reason}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
