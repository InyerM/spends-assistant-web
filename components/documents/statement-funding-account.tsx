'use client';
import { useTranslations, useLocale } from 'next-intl';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import { useFxReference } from '@/lib/api/queries/fx-reference.queries';
import type { Account } from '@/types';
export function StatementFundingAccount({
  accounts,
  value,
  onChange,
  disabled,
  currency,
  amount,
  date,
  fundingAmount,
  onFundingAmount,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  currency: string;
  amount: number;
  date: string;
  fundingAmount: string;
  onFundingAmount: (value: string) => void;
}): React.ReactElement {
  const t = useTranslations('statementConversion');
  const selected = accounts.find((account) => account.id === value);
  return (
    <div className='space-y-3'>
      <label className='block space-y-1 text-sm'>
        {t('fundingAccount')}
        <SearchableSelect
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          ariaLabel={t('fundingAccount')}
          placeholder={t('chooseAccount')}
          searchPlaceholder={t('searchAccount')}
          emptyText={t('noAccounts')}
          items={accounts
            .filter((a) => a.is_active && !a.deleted_at)
            .map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
        />
      </label>
      {selected && selected.currency !== currency && (
        <ConversionAmount
          currency={selected.currency}
          statementCurrency={currency}
          amount={amount}
          date={date}
          value={fundingAmount}
          onChange={onFundingAmount}
          disabled={disabled}
        />
      )}
    </div>
  );
}
function ConversionAmount({
  currency,
  statementCurrency,
  amount,
  date,
  value,
  onChange,
  disabled,
}: {
  currency: string;
  statementCurrency: string;
  amount: number;
  date: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}): React.ReactElement {
  const t = useTranslations('statementConversion'),
    locale = useLocale();
  const quote = useFxReference(date);
  const estimate = quote.data
    ? statementCurrency === 'USD' && currency === 'COP'
      ? amount * quote.data.rate
      : statementCurrency === 'COP' && currency === 'USD'
        ? amount / quote.data.rate
        : null
    : null;
  return (
    <div className='bg-muted/40 space-y-3 rounded-lg p-3'>
      <label className='block space-y-1 text-sm'>
        {t('debitedAmount', { currency })}
        <Input
          type='number'
          inputMode='decimal'
          min='0.01'
          step='0.01'
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label={t('debitedAmount', { currency })}
        />
      </label>
      {quote.isPending ? (
        <InlineLoader />
      ) : quote.data && estimate !== null ? (
        <div className='space-y-2 text-xs'>
          <p className='text-muted-foreground'>
            {t('reference', {
              rate: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
                quote.data.rate,
              ),
              date: quote.data.date,
            })}
          </p>
          <Button
            size='sm'
            variant='outline'
            disabled={disabled}
            onClick={() => onChange(estimate.toFixed(2))}>
            {t('useEstimate', {
              amount: new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
                estimate,
              ),
            })}
          </Button>
          <a
            href={quote.data.source_url}
            target='_blank'
            rel='noreferrer'
            className='text-brand block underline'>
            {t('source')}
          </a>
        </div>
      ) : (
        <p className='text-muted-foreground text-xs'>{t('referenceUnavailable')}</p>
      )}
      <p className='text-muted-foreground text-xs'>{t('reviewDebit')}</p>
    </div>
  );
}
